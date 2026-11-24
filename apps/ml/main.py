"""HTTP API for the Coolbox operational demo."""

from collections import deque
from contextlib import asynccontextmanager
from datetime import date, timedelta
from functools import lru_cache
import gzip
from hashlib import sha256
import hmac
import json
import logging
import os
from threading import Event, Lock, Thread
import time
from typing import Literal
from uuid import UUID

from botocore.exceptions import BotoCoreError, ClientError
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from itsdangerous import BadData, URLSafeTimedSerializer
from pydantic import BaseModel, Field, SecretStr

from inventory import category_sales_history, forecast_indicators
from jobs import dataset_key, enqueue, model_key, worker
from persistence import configuration

load_dotenv()
LOGGER = logging.getLogger(__name__)
SESSION_AGE = 3600
COOKIE = 'coolbox_ml_session'
PREFIX = '/api/ml'


@asynccontextmanager
async def lifespan(app):
    accounts = {role: (os.getenv(f'{role.upper()}_EMAIL', '').strip().casefold(),
                       os.getenv(f'{role.upper()}_PASS', '')) for role in ('admin', 'dev')}
    secret = os.getenv('ML_SESSION_SECRET', '')
    if len(secret) < 32 or any(not email or not password for email, password in accounts.values()):
        raise RuntimeError('Configura las dos cuentas y ML_SESSION_SECRET (mínimo 32 caracteres)')
    if accounts['admin'][0] == accounts['dev'][0]:
        raise RuntimeError('Los correos de admin y dev deben ser distintos')
    if accounts['admin'][1] == accounts['dev'][1]:
        raise RuntimeError('Las contraseñas de admin y dev deben ser distintas')
    app.state.accounts = accounts
    app.state.signer = URLSafeTimedSerializer(
        hmac.digest(secret.encode(), json.dumps(accounts).encode(), 'sha256'), salt='coolbox-ml-v1',
        signer_kwargs={'digest_method': sha256},
    )
    app.state.origins = {origin.strip().rstrip('/') for origin in
                         os.getenv('ML_ALLOWED_ORIGINS', 'http://localhost:5173').split(',') if origin.strip()}
    app.state.secure = os.getenv('ML_COOKIE_SECURE', 'true').lower() != 'false'
    app.state.db, app.state.artifacts = configuration()
    app.state.login_lock = Lock()
    app.state.login_attempts = deque()

    @lru_cache(maxsize=4)
    def forecasts(run_id, model):
        return json.loads(app.state.artifacts.get(model_key(run_id, model, 'forecast.json')))

    @lru_cache(maxsize=4)
    def sales_history(run_id):
        dataset = json.loads(gzip.decompress(app.state.artifacts.get(dataset_key(run_id))))
        return category_sales_history(dataset)

    app.state.forecasts = forecasts
    app.state.sales_history = sales_history
    stop, wake = Event(), Event()
    app.state.wake = wake
    thread = Thread(target=worker, args=(app.state.db, app.state.artifacts, stop, wake), daemon=True)
    thread.start()
    try:
        yield
    finally:
        stop.set()
        wake.set()


app = FastAPI(title='Coolbox ML', lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware('http')
async def protect_requests(request, call_next):
    if request.method not in ('GET', 'HEAD') and request.headers.get('origin') not in app.state.origins:
        result = JSONResponse({'detail': 'Origen no autorizado'}, status_code=403)
    else:
        try:
            result = await call_next(request)
        except Exception:
            LOGGER.exception('Falló la solicitud %s', request.url.path)
            result = JSONResponse({'detail': 'Servicio temporalmente no disponible'}, status_code=503)
    result.headers['Cache-Control'] = 'no-store'
    return result


@app.exception_handler(RequestValidationError)
async def invalid_input(_request, _error):
    return JSONResponse({'detail': 'Los datos de la solicitud no son válidos'}, status_code=422)


def role_for(request: Request):
    token = request.cookies.get(COOKIE)
    if token:
        try:
            role = app.state.signer.loads(token, max_age=SESSION_AGE)
            if role in app.state.accounts:
                return role
        except BadData:
            pass
    raise HTTPException(401, 'Inicia sesión')


def require_role(expected):
    def check(role=Depends(role_for)):
        if role != expected:
            raise HTTPException(403, 'Esta cuenta no tiene acceso a este panel')
    return Depends(check)


admin_only = require_role('admin')
dev_only = require_role('dev')


class Credentials(BaseModel):
    email: str = Field(min_length=1, max_length=254)
    password: SecretStr = Field(min_length=1, max_length=256)


class TrainRequest(BaseModel):
    compare_stock: bool = True


class ModelSelection(BaseModel):
    run_id: UUID
    model: Literal['baseline', 'linear', 'tree', 'forest']


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.post(f'{PREFIX}/login')
def login(credentials: Credentials, response: Response):
    with app.state.login_lock:
        attempts = app.state.login_attempts
        now = time.monotonic()
        while attempts and now - attempts[0] >= 60:
            attempts.popleft()
        if len(attempts) >= 30:
            raise HTTPException(429, 'Demasiados intentos de acceso. Inténtalo en un minuto.')
        attempts.append(now)

    email = credentials.email.strip().casefold().encode()
    password = credentials.password.get_secret_value().encode()
    role = None
    for candidate, (expected_email, expected_pass) in app.state.accounts.items():
        email_matches = hmac.compare_digest(sha256(email).digest(), sha256(expected_email.encode()).digest())
        pass_matches = hmac.compare_digest(sha256(password).digest(), sha256(expected_pass.encode()).digest())
        if email_matches and pass_matches:
            role = candidate
    if not role:
        raise HTTPException(401, 'Correo o contraseña incorrectos')
    response.set_cookie(COOKIE, app.state.signer.dumps(role), max_age=SESSION_AGE, httponly=True,
                        secure=app.state.secure, samesite='strict', path=PREFIX)
    return {'role': role}


@app.get(f'{PREFIX}/session')
def session(role=Depends(role_for)):
    return {'role': role}


@app.post(f'{PREFIX}/logout', status_code=204, response_class=Response)
def logout(response: Response):
    response.delete_cookie(COOKIE, path=PREFIX, httponly=True, secure=app.state.secure, samesite='strict')


def active_model():
    models = app.state.db.execute("""
        SELECT a.run_id, a.model, a.activated_at, r.report_json
        FROM ml_active_model a JOIN ml_training_runs r ON r.id = a.run_id WHERE a.id = 1
    """)
    if models:
        model = models[0]
        model['report'] = json.loads(model.pop('report_json'))
        return model
    return None


def public_run(run):
    source = run.pop('report_json')
    run['report'] = json.loads(source) if source else None
    return run


@app.get(f'{PREFIX}/runs', dependencies=[dev_only])
def runs():
    results = app.state.db.execute("""
        SELECT id, status, stage, compare_stock, created_at, finished_at, error, report_json
        FROM ml_training_runs ORDER BY (status IN ('queued', 'running')) DESC, created_at DESC, rowid DESC LIMIT 30
    """)
    return {'active': active_model(), 'runs': [public_run(run) for run in results]}


@app.get(f'{PREFIX}/runs/{{run_id}}', dependencies=[dev_only])
def get_run(run_id: UUID):
    results = app.state.db.execute("""
        SELECT id, status, stage, compare_stock, created_at, finished_at, error, report_json
        FROM ml_training_runs WHERE id = ?
    """, str(run_id))
    if not results:
        raise HTTPException(404, 'Entrenamiento no encontrado')
    return public_run(results[0])


@app.post(f'{PREFIX}/runs', dependencies=[dev_only], status_code=202)
def create_run(config: TrainRequest):
    queued = enqueue(app.state.db, config.compare_stock)
    if not queued:
        raise HTTPException(409, 'Ya hay un entrenamiento pendiente')
    app.state.wake.set()
    return queued[0]


@app.post(f'{PREFIX}/active', dependencies=[dev_only])
def activate(selection: ModelSelection):
    run_id, model = str(selection.run_id), selection.model
    results = app.state.db.execute("""
        SELECT report_json FROM ml_training_runs WHERE id = ? AND status = 'completed'
    """, run_id)
    if not results or model not in json.loads(results[0]['report_json'])['models']:
        raise HTTPException(404, 'Modelo entrenado no encontrado')
    app.state.forecasts(run_id, model)
    app.state.db.execute("""
        INSERT INTO ml_active_model (id, run_id, model) VALUES (1, ?, ?)
        ON CONFLICT (id) DO UPDATE SET run_id = excluded.run_id, model = excluded.model,
          activated_at = CURRENT_TIMESTAMP
    """, run_id, model)
    return {'run_id': run_id, 'model': model}


@app.get(f'{PREFIX}/dashboard', dependencies=[admin_only])
def dashboard(lead_days: int = Query(7, ge=1, le=15), coverage_days: int = Query(14, ge=1, le=15)):
    active = active_model()
    if not active:
        return {'active': None, 'skus': [], 'categories': []}
    rows = app.state.forecasts(active['run_id'], active['model'])
    try:
        history = app.state.sales_history(active['run_id'])
    except (OSError, ValueError, BotoCoreError, ClientError):
        LOGGER.exception('No se pudo leer el historial de %s', active['run_id'])
        history = {}
    forecast_start = date.fromisoformat(active['report']['forecast_start'])
    days = [(forecast_start + timedelta(days=offset)).isoformat()
            for offset in range(active['report']['horizon_days'])]
    skus, categories = [], {}
    for row in rows:
        forecast = row['daily_forecast']
        scores = forecast_indicators(forecast, row['stock'], lead_days, coverage_days, row['price'])
        skus.append({**row, **scores})
        name = row['category']
        if name not in categories:
            categories[name] = {
                'name': name, 'forecast_units': 0, 'estimated_revenue': None, 'unpriced_skus': 0,
                'history': history.get(name, []),
                'projection': [{'day': day, 'units': 0} for day in days],
            }
        category = categories[name]
        for point, units in zip(category['projection'], forecast, strict=True):
            point['units'] += units
        category['forecast_units'] += scores['forecast_units']
        if scores['estimated_revenue'] is None:
            category['unpriced_skus'] += 1
        else:
            category['estimated_revenue'] = (category['estimated_revenue'] or 0) + scores['estimated_revenue']
    return {'active': active, 'skus': skus, 'categories': list(categories.values())}

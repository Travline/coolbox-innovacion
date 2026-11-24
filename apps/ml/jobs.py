"""A durable queue with one training run at a time across deployments."""

import gzip
import json
import logging
import pickle
from threading import Event
import uuid

from demand import build_dataset, compare_and_fit

LOGGER = logging.getLogger(__name__)
LEASE_SECONDS = 300


def model_key(run_id, model, filename):
    return f'demand/v1/{run_id}/{model}/{filename}'


def dataset_key(run_id):
    return f'demand/v1/{run_id}/dataset.json.gz'


def json_bytes(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False).encode()


def enqueue(db, compare_stock):
    return db.execute("""
        INSERT INTO ml_training_runs (id, status, stage, compare_stock)
        VALUES (?, 'queued', 'En cola', ?) ON CONFLICT DO NOTHING RETURNING id, status
    """, str(uuid.uuid4()), int(compare_stock))


def advance(db, run_id, stage):
    updated = db.execute("""
        UPDATE ml_training_runs SET stage = ?, lease_until = unixepoch() + ?
        WHERE id = ? AND status = 'running' AND lease_until > unixepoch() RETURNING id
    """, stage, LEASE_SECONDS, run_id)
    if not updated:
        raise RuntimeError('El entrenamiento perdió su reserva')


def train(db, artifacts, job):
    run_id = job['id']
    sales, inventory, report = build_dataset(db, bool(job['compare_stock']))
    advance(db, run_id, 'Guardando datos de entrenamiento')
    dataset = {'sales': sales, 'inventory': inventory, 'metadata': report}
    artifacts.put(dataset_key(run_id), gzip.compress(json_bytes(dataset)), 'application/gzip')
    metrics_by_model = {}

    for model_id, model, metrics, forecast in compare_and_fit(sales):
        advance(db, run_id, f'Guardando resultados: {model_id}')
        if model is not None:
            artifacts.put(model_key(run_id, model_id, 'model.pkl'), pickle.dumps(model), 'application/octet-stream')
        rows = [{**sku, 'daily_forecast': forecast[sku['sku_id']]} for sku in inventory]
        artifacts.put(model_key(run_id, model_id, 'forecast.json'), json_bytes(rows), 'application/json')
        metrics_by_model[model_id] = metrics

    report['models'] = metrics_by_model
    db.execute("""
        UPDATE ml_training_runs SET status = 'completed', stage = 'Completado',
          report_json = ?, finished_at = CURRENT_TIMESTAMP, lease_until = NULL
        WHERE id = ? AND status = 'running' AND lease_until > unixepoch()
    """, json_bytes(report).decode(), run_id)


def work_once(db, artifacts):
    pending = db.execute("""
        SELECT id, status, lease_until <= unixepoch() AS expired
        FROM ml_training_runs WHERE status IN ('queued', 'running')
    """)
    if not pending:
        return
    run = pending[0]
    if run['status'] == 'running':
        if run['expired']:
            db.execute("""
                UPDATE ml_training_runs SET status = 'interrupted', stage = 'Interrumpido',
                  error = 'El proceso perdió su reserva. Puedes iniciar otro entrenamiento.',
                  finished_at = CURRENT_TIMESTAMP, lease_until = NULL
                WHERE id = ? AND status = 'running' AND lease_until <= unixepoch()
            """, run['id'])
        return
    jobs = db.execute("""
        UPDATE ml_training_runs SET status = 'running', stage = 'Preparando datos',
          lease_until = unixepoch() + ?
        WHERE id = ? AND status = 'queued' RETURNING id, compare_stock
    """, LEASE_SECONDS, run['id'])
    if not jobs:
        return
    job = jobs[0]
    try:
        train(db, artifacts, job)
    except Exception:
        LOGGER.exception('Falló el entrenamiento %s', job['id'])
        db.execute("""
            UPDATE ml_training_runs SET status = 'failed', stage = 'Fallido',
              error = 'Falló el entrenamiento. Consulta los logs del servicio.',
              finished_at = CURRENT_TIMESTAMP, lease_until = NULL
            WHERE id = ? AND status = 'running' AND lease_until > unixepoch()
        """, job['id'])


def worker(db, artifacts, stop: Event, wake: Event):
    while not stop.is_set():
        try:
            work_once(db, artifacts)
        except Exception:
            LOGGER.exception('No se pudo procesar la cola de entrenamiento')
        wake.wait(10)
        wake.clear()

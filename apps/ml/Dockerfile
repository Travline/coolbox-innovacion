FROM python:3.14-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1

WORKDIR /srv/apps/ml
COPY apps/ml/requirements.txt .
RUN pip install --no-cache-dir --only-binary=:all: -r requirements.txt \
    && useradd --create-home --uid 10001 ml \
    && mkdir -p /srv/apps/ml/.local \
    && chown ml:ml /srv/apps/ml/.local

COPY apps/ml/*.py ./
COPY database/004_demand_forecasts.sql /srv/database/004_demand_forecasts.sql

USER ml
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port \"${PORT:-8000}\""]

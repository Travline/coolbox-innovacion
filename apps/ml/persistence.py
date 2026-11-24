"""Adapters for Turso/SQLite metadata and Supabase S3/local artifacts."""

from contextlib import closing
import os
import sqlite3
from pathlib import Path

import boto3
import httpx
from botocore.config import Config


class Database:
    def __init__(self, local_dir):
        self.local = local_dir / 'ml.sqlite3' if local_dir else None
        self.url = os.getenv('TURSO_DATABASE_URL', '').replace('libsql://', 'https://', 1)
        self.token = os.getenv('TURSO_AUTH_TOKEN')
        if not self.local and (not self.url.startswith('https://') or not self.token):
            raise RuntimeError('Configura TURSO_DATABASE_URL y TURSO_AUTH_TOKEN')

    def execute(self, sql, *args):
        if self.local:
            with closing(sqlite3.connect(self.local)) as connection, connection:
                connection.execute('PRAGMA foreign_keys = ON')
                connection.row_factory = sqlite3.Row
                return [dict(row) for row in connection.execute(sql, args)]

        encoded = [
            {'type': 'integer', 'value': str(value)} if isinstance(value, int)
            else {'type': 'text', 'value': value} for value in args
        ]
        response = httpx.post(f'{self.url.rstrip("/")}/v2/pipeline', timeout=12,
                             headers={'Authorization': f'Bearer {self.token}'}, json={'requests': [
                                 {'type': 'execute', 'stmt': {'sql': sql, 'args': encoded, 'want_rows': True}},
                                 {'type': 'close'},
                             ]})
        response.raise_for_status()
        entry = response.json()['results'][0]
        if entry['type'] != 'ok':
            raise RuntimeError(f'Error SQL de Turso: {entry["error"].get("code")}')
        result = entry['response']['result']
        names = [column['name'] for column in result['cols']]
        decoders = {'integer': int, 'float': float}
        return [
            dict(zip(names, (decoders.get(cell['type'], lambda value: value)(cell.get('value'))
                             for cell in row), strict=True))
            for row in result['rows']
        ]


class Artifacts:
    def __init__(self, local_dir):
        self.local = local_dir
        if local_dir:
            return
        names = ('S3_ENDPOINT_URL', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_BUCKET')
        endpoint, region, key, secret, self.bucket = (os.getenv(name) for name in names)
        if not all((endpoint, region, key, secret, self.bucket)) or not endpoint.startswith('https://'):
            raise RuntimeError('Configura las variables S3 para el bucket de modelos')
        self.client = boto3.client(
            's3', endpoint_url=endpoint, region_name=region, aws_access_key_id=key,
            aws_secret_access_key=secret, config=Config(
                signature_version='s3v4', s3={'addressing_style': 'path'}, connect_timeout=5, read_timeout=10,
                retries={'total_max_attempts': 2}, request_checksum_calculation='when_required',
                response_checksum_validation='when_required',
            ),
        )

    def put(self, key, data, content_type):
        if self.local:
            path = self.local / key
            path.parent.mkdir(parents=True, exist_ok=True)
            temp = path.with_suffix('.tmp')
            temp.write_bytes(data)
            temp.replace(path)
        else:
            self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)

    def get(self, key):
        if self.local:
            return (self.local / key).read_bytes()
        body = self.client.get_object(Bucket=self.bucket, Key=key)['Body']
        try:
            return body.read()
        finally:
            body.close()


def configuration():
    directory = os.getenv('ML_LOCAL_DIR')
    local = Path(directory).resolve() if directory else None
    if local:
        local.mkdir(parents=True, exist_ok=True)
        migration = Path(__file__).resolve().parents[2] / 'database' / '004_demand_forecasts.sql'
        with closing(sqlite3.connect(local / 'ml.sqlite3')) as connection, connection:
            connection.executescript(migration.read_text())
    return Database(local), Artifacts(local)

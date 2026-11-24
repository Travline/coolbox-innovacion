import asyncio
from contextlib import asynccontextmanager
import gzip
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import httpx

from demand import current_offer, generate_history
from inventory import forecast_indicators
from jobs import enqueue, work_once
from main import app
from persistence import configuration


SAMPLE = {
    'sku_id': 'sku', 'product_id': 'p', 'name': 'Audífonos', 'slug': 'demo', 'category_id': '1',
    'stock': 31, 'price': 60, 'seller_id': 's',
}
ORIGIN = {'Origin': 'http://localhost:5173'}
PREFIX = '/api/ml'


class DataTests(unittest.TestCase):
    def test_comparison_matches_seller_and_preserves_the_drop(self):
        item = {'itemId': 'sku', 'sellers': [{
            'sellerDefault': True, 'sellerId': 's', 'commertialOffer': {'AvailableQuantity': 9},
        }]}
        self.assertEqual(current_offer([{'productId': 'p', 'items': [item]}], SAMPLE), 9)
        self.assertIsNone(current_offer([{'productId': 'p', 'items': [item]}], {**SAMPLE, 'seller_id': 'unknown'}))
        history, inventory, inferred = generate_history([SAMPLE], {'sku': 9})
        self.assertEqual((inventory[0]['stock'], inferred), (9, 1))
        proxy = [row for row in history if row['origin'] == 'stock_proxy']
        self.assertEqual((len(proxy), sum(row['units'] for row in proxy)), (9, 22))
        self.assertEqual((proxy[0]['day'], proxy[-1]['day']), ('2026-11-16', '2026-11-24'))
        self.assertEqual(generate_history([SAMPLE], {'sku': 9})[0], history)
        for current in ({}, {'sku': 32}):
            self.assertEqual(generate_history([SAMPLE], current)[2], 0)

    def test_inventory_uses_cumulative_forecast_and_preserves_unknowns(self):
        result = forecast_indicators([2, 4, 1], 5, 2, 1, 10)
        self.assertAlmostEqual(result['coverage_days'], 1.75)
        self.assertTrue(result['stockout_risk'])
        self.assertEqual((result['suggested_reorder'], result['estimated_revenue']), (2, 70))
        unknown = forecast_indicators([1], None, 1, 1, None)
        self.assertIsNone(unknown['suggested_reorder'])
        self.assertIsNone(unknown['stockout_risk'])
        self.assertIsNone(unknown['estimated_revenue'])


@asynccontextmanager
async def running_api():
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            yield client


class WorkflowTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        directory = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(patch.dict(os.environ, {
            'ML_LOCAL_DIR': directory, 'ML_CATALOG_SNAPSHOT': '', 'ML_COOKIE_SECURE': 'false',
            'ML_ALLOWED_ORIGINS': ORIGIN['Origin'], 'ML_SESSION_SECRET': 'demo-test-secret-' * 3,
            'ADMIN_EMAIL': 'admin@example.test', 'ADMIN_PASS': 'admin-test',
            'DEV_EMAIL': 'dev@example.test', 'DEV_PASS': 'dev-test',
        }))
        self.directory = Path(directory)

    async def login(self, client, role):
        result = await client.post(f'{PREFIX}/login', headers=ORIGIN, json={
            'email': f'{role}@example.test', 'password': f'{role}-test',
        })
        self.assertEqual(result.status_code, 200, result.text)
        self.assertIn('HttpOnly', result.headers['set-cookie'])
        self.assertEqual(result.json()['role'], role)

    async def test_train_activate_and_restore_active_forecast(self):
        with patch('demand.catalog_sample', return_value=([SAMPLE], '2026-11-15T10:00:00Z')):
            async with running_api() as client:
                self.assertEqual((await client.get('/health')).status_code, 200)
                self.assertEqual((await client.get(f'{PREFIX}/dashboard')).status_code, 401)
                self.assertEqual((await client.post(f'{PREFIX}/login', json={})).status_code, 403)
                await self.login(client, 'dev')
                self.assertEqual((await client.get(f'{PREFIX}/dashboard')).status_code, 403)
                created = await client.post(f'{PREFIX}/runs', headers=ORIGIN, json={'compare_stock': False})
                self.assertEqual(created.status_code, 202, created.text)
                run_id = created.json()['id']
                for _ in range(200):
                    run = (await client.get(f'{PREFIX}/runs/{run_id}')).json()
                    if run['status'] not in ('queued', 'running'):
                        break
                    await asyncio.sleep(0.05)
                self.assertEqual(run['status'], 'completed', run)
                self.assertEqual(set(run['report']['models']), {'baseline', 'linear', 'tree', 'forest'})
                self.assertEqual(run['report']['test_start'], '2026-11-11')
                self.assertTrue(all(scores['mae'] >= 0 for scores in run['report']['models'].values()))
                stored = self.directory / 'demand' / 'v1' / run_id
                self.assertTrue((stored / 'forest' / 'model.pkl').stat().st_size > 0)
                data = json.loads(gzip.decompress((stored / 'dataset.json.gz').read_bytes()))
                self.assertEqual(set(row['origin'] for row in data['sales']), {'synthetic'})
                activated = await client.post(f'{PREFIX}/active', headers=ORIGIN, json={'run_id': run_id, 'model': 'forest'})
                self.assertEqual(activated.status_code, 200, activated.text)

        async with running_api() as client:
            await self.login(client, 'admin')
            self.assertEqual((await client.get(f'{PREFIX}/runs')).status_code, 403)
            self.assertEqual((await client.post(f'{PREFIX}/active', headers=ORIGIN, json={
                'run_id': run_id, 'model': 'linear',
            })).status_code, 403)
            result = (await client.get(f'{PREFIX}/dashboard?lead_days=7&coverage_days=14')).json()
            self.assertEqual(result['active']['run_id'], run_id)
            self.assertEqual(result['active']['model'], 'forest')
            self.assertEqual(len(result['skus'][0]['daily_forecast']), 30)
            self.assertEqual(result['categories'][0]['forecast_units'], result['skus'][0]['forecast_units'])
            self.assertEqual((await client.post(f'{PREFIX}/logout', headers=ORIGIN, json={})).status_code, 204)
            self.assertEqual((await client.get(f'{PREFIX}/dashboard')).status_code, 401)

    def test_expired_lease_frees_queue_and_failed_upload_fails_job(self):
        db, artifacts = configuration()
        stuck = enqueue(db, False)[0]['id']
        self.assertFalse(enqueue(db, False))
        db.execute("UPDATE ml_training_runs SET status = 'running', lease_until = 0 WHERE id = ?", stuck)
        work_once(db, artifacts)
        self.assertEqual(db.execute('SELECT status FROM ml_training_runs WHERE id = ?', stuck)[0]['status'], 'interrupted')
        retry = enqueue(db, False)[0]['id']
        with (
            patch('demand.catalog_sample', return_value=([SAMPLE], None)),
            patch.object(artifacts, 'put', side_effect=OSError('bucket failure')),
            self.assertLogs('jobs', 'ERROR'),
        ):
            work_once(db, artifacts)
        self.assertEqual(db.execute('SELECT status FROM ml_training_runs WHERE id = ?', retry)[0]['status'], 'failed')
        self.assertFalse(db.execute('SELECT * FROM ml_active_model'))

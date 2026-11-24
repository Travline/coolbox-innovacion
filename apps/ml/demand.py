"""Build a reproducible demo dataset and compare forecasts out of time."""

from datetime import date, datetime, timedelta, timezone
from hashlib import sha256
import json
import logging
import math
import os
from pathlib import Path
import random
import time
from urllib.parse import quote

import httpx
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.tree import DecisionTreeRegressor

CATEGORIES = {'1': 'Audio', '20': 'Celulares y Accesorios', '47': 'Cómputo',
              '171': 'Gamer', '942': 'Smart Home', '101': 'TV y Video', '76': 'Hogar'}
END = date(2026, 11, 24)
PROXY_START = date(2026, 11, 16)
START = PROXY_START - timedelta(days=84)
HORIZON = 30
TEST_DAYS = 14
LOGGER = logging.getLogger(__name__)

SAMPLE_SQL = """
WITH memberships AS (
  SELECT product_id, MIN(category_id) AS category_id
  FROM product_categories
  WHERE category_id IN ('1', '20', '47', '171', '942', '101', '76')
  GROUP BY product_id
), variants AS (
  SELECT s.sku_id, s.product_id, p.name, p.slug, m.category_id, s.stock, s.price, s.seller_id,
         ROW_NUMBER() OVER (PARTITION BY p.product_id ORDER BY s.stock IS NULL, s.sku_id) AS variant
  FROM memberships m JOIN products p USING (product_id) JOIN skus s USING (product_id)
), ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY slug IS NULL, stock IS NULL, product_id) AS rank
  FROM variants WHERE variant = 1
)
SELECT sku_id, product_id, name, slug, category_id, stock, price, seller_id
FROM ranked WHERE rank <= 8 ORDER BY category_id, sku_id
"""


def catalog_sample(db, snapshot=None):
    if not snapshot:
        rows = db.execute(SAMPLE_SQL)
        metadata = db.execute('SELECT extracted_at FROM catalog_metadata WHERE id = 1')
        return rows, metadata[0]['extracted_at'] if metadata else None

    products = json.loads(Path(snapshot).read_text())
    selected = {category: [] for category in CATEGORIES}
    for product in products:
        categories = sorted(category['id'] for category in product['categories'] if category['id'] in CATEGORIES)
        variants = sorted(product['skus'], key=lambda sku: (sku['stock'] is None, sku['skuId']))
        if not categories or not variants:
            continue
        sku = variants[0]
        category_id = categories[0]
        selected[category_id].append({
            'sku_id': sku['skuId'], 'product_id': product['productId'], 'name': product['name'],
            'slug': product['slug'], 'category_id': category_id, 'stock': sku['stock'],
            'price': sku['price'], 'seller_id': (sku['seller'] or {}).get('id'),
        })
    rows = []
    for _, products_in_category in sorted(selected.items()):
        ranked = sorted(products_in_category, key=lambda row: (
            row['slug'] is None, row['stock'] is None, row['product_id']))
        rows.extend(sorted(ranked[:8], key=lambda row: row['sku_id']))
    return rows, products[0].get('extractedAt') if products else None


def known_stock(value):
    if isinstance(value, (int, float)) and not isinstance(value, bool) and 0 <= value < 2**53:
        if int(value) == value:
            return int(value)
    return None


def current_offer(products, sku):
    if not isinstance(products, list):
        return None
    for product in products:
        if not isinstance(product, dict) or product.get('productId') != sku['product_id']:
            continue
        for item in product.get('items') or []:
            if not isinstance(item, dict) or item.get('itemId') != sku['sku_id']:
                continue
            sellers = [entry for entry in item.get('sellers') or [] if isinstance(entry, dict)]
            seller = next((entry for entry in sellers if entry.get('sellerDefault') is True), None)
            seller = seller or (sellers[0] if sellers else {})
            if not sku['seller_id'] or seller.get('sellerId') != sku['seller_id']:
                return None
            return known_stock((seller.get('commertialOffer') or {}).get('AvailableQuantity'))
    return None


def fetch_current_stock(sample):
    result = {}
    errors = consecutive_errors = 0
    deadline = time.monotonic() + 65
    with httpx.Client(timeout=4, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json'}) as client:
        for sku in sample:
            if time.monotonic() >= deadline or consecutive_errors >= 4:
                break
            if not sku['slug'] or not sku['seller_id']:
                continue
            slug = quote(sku['slug'], safe='')
            try:
                response = client.get(f'https://www.coolbox.pe/api/catalog_system/pub/products/search/{slug}/p')
                if response.status_code == 404:
                    consecutive_errors = 0
                    continue
                response.raise_for_status()
                stock = current_offer(response.json(), sku)
                if stock is not None:
                    result[sku['sku_id']] = stock
                consecutive_errors = 0
            except (httpx.HTTPError, ValueError, TypeError, AttributeError):
                errors += 1
                consecutive_errors += 1
            finally:
                time.sleep(0.4)
    return result, errors


def generate_history(sample, current):
    sales = []
    inventory = []
    inferred_skus = 0
    for sku in sample:
        sku_id = sku['sku_id']
        rng = random.Random(int.from_bytes(sha256(f'coolbox-v1:{sku_id}'.encode()).digest()[:8]))
        old = known_stock(sku['stock'])
        new = current.get(sku_id)
        drop = max(0, old - new) if old is not None and new is not None else 0
        proxy = [0] * ((END - PROXY_START).days + 1)
        if drop:
            inferred_skus += 1
            # Sequential binomial draws distribute very large drops in fixed time.
            remaining = drop
            for index in range(len(proxy) - 1):
                proxy[index] = rng.binomialvariate(remaining, 1 / (len(proxy) - index))
                remaining -= proxy[index]
            proxy[-1] = remaining

        level = rng.uniform(0.3, 8)
        for offset in range((END - START).days + 1):
            day = START + timedelta(days=offset)
            if drop and day >= PROXY_START:
                units = proxy[(day - PROXY_START).days]
                origin = 'stock_proxy'
            else:
                weekday_factor = 1.35 if day.weekday() >= 5 else 1
                wave = 1 + 0.15 * math.sin(offset / 9)
                units = max(0, round(rng.gauss(level * weekday_factor * wave, 1.4)))
                origin = 'synthetic'
            sales.append({'day': day.isoformat(), 'sku_id': sku_id, 'units': units, 'origin': origin})
        inventory.append({
            'sku_id': sku_id, 'product_id': sku['product_id'], 'name': sku['name'],
            'category': CATEGORIES[sku['category_id']], 'price': sku['price'], 'old_stock': old,
            'stock': new if new is not None else old,
            'stock_origin': 'coolbox' if new is not None else 'catalog_snapshot' if old is not None else 'unknown',
        })
    return sales, inventory, inferred_skus


def features(day, levels):
    angle = 2 * math.pi * day.weekday() / 7
    return [math.sin(angle), math.cos(angle), levels[-7], sum(levels[-7:]) / 7, sum(levels[-28:]) / 28]


def fit_model(build, calendar, series):
    if build is None:
        return None
    inputs, targets = [], []
    for values in series:
        for i in range(28, len(calendar)):
            inputs.append(features(calendar[i], values[:i]))
            targets.append(values[i])
    return build().fit(np.asarray(inputs), np.asarray(targets))


def roll_forward(model, days, series):
    histories = [list(values) for values in series]
    forecasts = []
    for day in days:
        inputs = np.asarray([features(day, history) for history in histories])
        predict = inputs[:, 3] if model is None else model.predict(inputs)
        projected = np.maximum(predict, 0).tolist()
        for history, value in zip(histories, projected, strict=True):
            history.append(value)
        forecasts.append(projected)
    return np.asarray(forecasts)


def compare_and_fit(sales):
    units = pd.DataFrame(sales).pivot(index='day', columns='sku_id', values='units')
    calendar = [date.fromisoformat(day) for day in units.index]
    series = units.to_numpy().T.tolist()
    training_calendar = calendar[:-TEST_DAYS]
    training_series = [values[:-TEST_DAYS] for values in series]
    actual = units.to_numpy()[-TEST_DAYS:].ravel()
    future = [calendar[-1] + timedelta(days=offset) for offset in range(1, HORIZON + 1)]
    for model_id, build in (
        ('baseline', None),
        ('linear', LinearRegression),
        ('tree', lambda: DecisionTreeRegressor(max_depth=6, min_samples_leaf=8, random_state=42)),
        ('forest', lambda: RandomForestRegressor(
            n_estimators=50, max_depth=8, min_samples_leaf=6, random_state=42, n_jobs=1)),
    ):
        evaluated = fit_model(build, training_calendar, training_series)
        predicted = roll_forward(evaluated, calendar[-TEST_DAYS:], training_series).ravel()
        metrics = {
            'mae': float(mean_absolute_error(actual, predicted)),
            'r2': float(r2_score(actual, predicted)) if np.ptp(actual) else None,
        }
        final = fit_model(build, calendar, series)
        forecasts = roll_forward(final, future, series)
        yield model_id, final, metrics, dict(zip(units.columns, forecasts.T.tolist(), strict=True))


def build_dataset(db, compare_stock):
    sample, catalog_date = catalog_sample(db, os.getenv('ML_CATALOG_SNAPSHOT'))
    if not sample:
        raise ValueError('El catálogo no contiene SKU para entrenar')
    current, errors = fetch_current_stock(sample) if compare_stock else ({}, 0)
    sales, inventory, inferred = generate_history(sample, current)
    metadata = {
        'history_start': START.isoformat(), 'history_end': END.isoformat(),
        'test_start': (END - timedelta(days=TEST_DAYS - 1)).isoformat(), 'test_end': END.isoformat(),
        'forecast_start': (END + timedelta(days=1)).isoformat(), 'horizon_days': HORIZON,
        'catalog_snapshot_at': catalog_date,
        'stock_checked_at': datetime.now(timezone.utc).isoformat() if compare_stock else None,
        'stock_matches': len(current), 'stock_errors': errors, 'inferred_skus': inferred,
        'sku_count': len(sample), 'observations': len(sales),
        'proxy_start': PROXY_START.isoformat(),
    }
    LOGGER.info('Muestra de %d SKU: %d stocks comparables, %d con caídas', len(sample), len(current), inferred)
    return sales, inventory, metadata

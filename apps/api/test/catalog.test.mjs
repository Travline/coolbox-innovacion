import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';
import { createCatalog } from '../dist/catalog.js';
import { AppError } from '../dist/errors.js';
import { EMBEDDING_VERSION, MODEL_ID } from '../dist/embedding.js';

const unit = (position) => Array.from({ length: 384 }, (_, index) => index === position ? 1 : 0);
async function fixture() {
  const db = createClient({ url: 'file::memory:' });
  for (const path of ['../../../database/001_initial.sql', '../../../database/002_embedding_hash.sql']) {
    await db.executeMultiple(await readFile(new URL(path, import.meta.url), 'utf8'));
  }
  for (const [id, name, brand, embedding] of [['p1', 'Laptop Acer', 'Acer', unit(0)], ['p2', 'Audífonos Sony', 'Sony', unit(1)]]) {
    await db.execute({ sql: 'INSERT INTO products (product_id, name, brand, specifications_json, embedding, embedding_model, embedding_version, extracted_at, updated_at) VALUES (?, ?, ?, ?, vector32(?), ?, ?, ?, ?)', args: [id, name, brand, '{}', JSON.stringify(embedding), MODEL_ID, EMBEDDING_VERSION, '2026-01-01', '2026-01-01'] });
  }
  for (const [id, product, price, stock] of [['cheap', 'p1', 100, 0], ['available', 'p1', 200, 2], ['headset', 'p2', 50, 3]]) {
    await db.execute({sql:'INSERT INTO skus (sku_id, product_id, price, stock) VALUES (?, ?, ?, ?)',args:[id, product, price, stock]});
  }
  return db;
}

test('lectura, filtros de una misma variante y ausencia de resultados', async () => {
  const db = await fixture();
  try {
    const catalog = createCatalog(db, async () => unit(0));
    assert.equal((await catalog.getProductById('p1')).name, 'Laptop Acer');
    assert.equal(await catalog.getProductById('no existe'), null);
    assert.deepEqual(await catalog.searchProducts({text:'laptop',brand:'Sony'}), []);
    assert.deepEqual(await catalog.searchProducts({text:'laptop',maxPrice:150,inStock:true}), []);
    const results = await catalog.searchProducts({text:'laptop',maxPrice:200,inStock:true});
    assert.equal(results.length, 1);
    assert.equal(results[0].sku.id, 'available');
    assert.equal(results[0].sku.price, 200);
    assert.equal(results[0].sku.stock, 2);
    await assert.rejects(catalog.searchProducts({text:'',limit:30}), {code:'INPUT'});
    await assert.rejects(catalog.searchProducts({text:'x',minPrice:5,maxPrice:1}), {code:'INPUT'});
    await assert.rejects(catalog.searchProducts({text:'x',sql:'DELETE FROM products'}), {code:'INPUT'});
    const marginal = unit(0).map((value, index) => index === 0 ? 0.85 : index === 1 ? Math.sqrt(1 - 0.85 ** 2) : value);
    assert.deepEqual(await createCatalog(db, async () => marginal).searchProducts({text:'producto inexistente'}), []);
    assert.equal((await db.execute('SELECT COUNT(*) AS n FROM products')).rows[0].n, 2);
  } finally { db.close(); }
});

test('distingue fallos de base y de inferencia de una búsqueda vacía', async () => {
  const db = await fixture();
  try {
    const brokenModel = createCatalog(db, async () => { throw new AppError('EMBEDDING', 'error controlado'); });
    await assert.rejects(brokenModel.searchProducts({text:'laptop'}), {code:'EMBEDDING'});
    const brokenDb = createCatalog({execute: async () => {throw new Error('internal');}}, async () => unit(0));
    await assert.rejects(brokenDb.searchProducts({text:'laptop'}), {code:'DATABASE'});
  } finally {db.close();}
});

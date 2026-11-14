import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { createClient } from '@libsql/client';
const source = await readFile(new URL('../src/product-detail.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { loadProductDetail, selectDetailSku } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
async function fixture() {
  const db = createClient({ url: 'file::memory:' });
  await db.executeMultiple(`
    CREATE TABLE products (product_id TEXT PRIMARY KEY, name TEXT, brand TEXT, reference TEXT, description_html TEXT, description_text TEXT, specifications_json TEXT);
    CREATE TABLE skus (sku_id TEXT PRIMARY KEY, product_id TEXT, name TEXT, reference TEXT, images_json TEXT, seller_name TEXT, price REAL, list_price REAL, stock INTEGER);
    INSERT INTO products VALUES ('p1', 'Laptop real', 'Marca', 'ref', '<p>Hola</p>', 'Hola', '{"Memoria":["16 GB"]}');
    INSERT INTO skus VALUES ('s1', 'p1', 'Gris', 'ref1', '[{"url":"https://example.test/1.png","alt":"Frontal"}]', 'Vendedor 1', 100, 120, 2);
    INSERT INTO skus VALUES ('s2', 'p1', 'Negro', 'ref2', '[{"url":"https://example.test/2.png","alt":null},{"url":"javascript:alert(1)"}]', 'Vendedor 2', 200, NULL, 0);
  `);
  return db;
}
test('mantiene imágenes, precio, stock y vendedor de cada variante', async () => {
  const db = await fixture();
  try {
    const product = await loadProductDetail(db, 'p1');
    assert.equal(product.name, 'Laptop real');
    assert.deepEqual(product.specifications.Memoria, ['16 GB']);
    const a = selectDetailSku(product.skus, 's1').sku;
    const b = selectDetailSku(product.skus, 's2').sku;
    assert.deepEqual([a.name, a.price, a.stock, a.sellerName, a.images[0].url], ['Gris',100,2,'Vendedor 1','https://example.test/1.png']);
    assert.deepEqual([b.name, b.price, b.stock, b.sellerName, b.images[0].url], ['Negro',200,0,'Vendedor 2','https://example.test/2.png']);
    assert.equal(b.images.length, 1);
  } finally { db.close(); }
});
test('gestiona inexistentes, variantes inválidas y datos incompletos', async () => {
  const db = await fixture();
  try {
    assert.equal(await loadProductDetail(db, 'no-existe'), null);
    assert.equal(await loadProductDetail(db, "p1' OR 1=1 --"), null);
    const product = await loadProductDetail(db, 'p1');
    assert.deepEqual([selectDetailSku(product.skus, 'desconocido').sku.id, selectDetailSku(product.skus, 'desconocido').invalid], ['s1', true]);
    assert.deepEqual(selectDetailSku([], 'desconocido'), { sku: null, invalid: true });
    await db.execute("INSERT INTO products VALUES ('p2','Sin datos',NULL,NULL,NULL,NULL,'{}')");
    const missing = await loadProductDetail(db, 'p2');
    assert.equal(missing.descriptionText, null);
    assert.deepEqual(missing.skus, []);
    assert.equal(Object.keys(missing.specifications).length, 0);
    await assert.rejects(loadProductDetail(db, ''));
  } finally { db.close(); }
});
test('propaga errores de consulta para mostrar reintento', async () => {
  await assert.rejects(loadProductDetail({execute: async () => {throw new Error('offline');}}, 'p1'), /offline/);
});

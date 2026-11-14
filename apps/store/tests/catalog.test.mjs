import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
const source = await readFile(new URL('../src/catalog.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace("import { createClient } from '@libsql/client/web';", 'const createClient = () => { throw new Error("unexpected network"); };');
const catalog = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
test('categorías acordadas y relación de subcategorías por ruta', () => {
  assert.equal(catalog.MAIN_CATEGORIES.length, 7);
  const root = { id: '1', name: 'Audio', path: '/Audio/' };
  const categories = [root, { id: '2', name: 'Audífonos', path: '/Audio/Audífonos/' }, { id: '3', name: 'TWS', path: '/Audio/Audífonos/TWS/' }];
  assert.deepEqual(catalog.childCategories(root, categories).map(c => c.id), ['2']);
});
test('precios ausentes, descuentos e imágenes desconocidas', () => {
  assert.equal(catalog.discount(90, 100), 10);
  assert.equal(catalog.discount(null, 100), null);
  assert.equal(catalog.discount(100, 100), null);
  assert.equal(catalog.imageFromJson('malformed'), null);
  assert.equal(catalog.imageFromJson('[{"url":"https://example.test/a.jpg"}]'), 'https://example.test/a.jpg');
});
test('carga sin red conserva metadatos ausentes y selecciona datos por categoría', async () => {
  const db = { async batch(queries, mode) { assert.equal(mode, 'read'); assert.equal(queries.length, 3); return [{ rows: [{category_id: '1',name:'Audio',path:'/Audio/'}] }, { rows: [] }, { rows: [{category_id:'1',product_id:'p',name:'A',brand:null,sku_id:null,price:null,list_price:null,images_json:'[]'}] }]; } };
  const data = await catalog.loadHome(db);
  assert.equal(data.lastImport, null);
  assert.equal(data.products['1'][0].price, null);
  assert.equal(data.products['1'][0].name, 'A');
});
test('consultas de categoría devuelven productos, variantes y páginas desde libSQL', async () => {
  const { createClient } = await import('@libsql/client');
  const db = createClient({ url: 'file::memory:' });
  try {
    await db.executeMultiple(`CREATE TABLE categories (category_id TEXT, name TEXT, path TEXT); CREATE TABLE catalog_metadata (id INTEGER, last_successful_import_at TEXT); CREATE TABLE products (product_id TEXT, name TEXT, brand TEXT); CREATE TABLE skus (sku_id TEXT, product_id TEXT, price REAL, list_price REAL, images_json TEXT); CREATE TABLE product_categories (product_id TEXT, category_id TEXT); INSERT INTO categories VALUES ('1','Audio','/Audio/'); INSERT INTO products VALUES ('p1','Producto','Marca'); INSERT INTO skus VALUES ('s1','p1',50,100,'[]'); INSERT INTO product_categories VALUES ('p1','1');`);
    const home = await catalog.loadHome(db);
    assert.equal(home.products['1'][0].skuId, 's1');
    assert.equal(home.products['1'][0].price, 50);
    assert.equal((await catalog.loadCategory(db, '1', 0))[0].id, 'p1');
    assert.equal((await catalog.loadCategory(db, '1', 1)).length, 0);
  } finally { db.close(); }
});

test('busca en catálogo completo, combina marcas y precio en el mismo SKU y pagina de forma estable', async () => {
  const { createClient } = await import('@libsql/client');
  const db = createClient({ url: 'file::memory:' });
  try {
    await db.executeMultiple(`CREATE TABLE products (product_id TEXT, name TEXT, brand TEXT); CREATE TABLE skus (sku_id TEXT, product_id TEXT, price REAL, list_price REAL, images_json TEXT); CREATE TABLE product_categories (product_id TEXT, category_id TEXT);`);
    for (let i = 0; i < 30; i++) {
      const id = String(i).padStart(2,'0');
      await db.execute({sql:'INSERT INTO products VALUES (?,?,?)',args:[id, `Laptop ${id}`, i % 2 ? 'Marca B' : 'Marca A']});
      await db.execute({sql:'INSERT INTO product_categories VALUES (?,?)',args:[id,'cat']});
      await db.execute({sql:'INSERT INTO skus VALUES (?,?,?,?,?)',args:[`a${id}`,id,50,null,'[]']});
      await db.execute({sql:'INSERT INTO skus VALUES (?,?,?,?,?)',args:[`b${id}`,id,150,200,'[]']});
    }
    const params = new URLSearchParams('q=LAPTOP&categoria=cat&marca=Marca+A&marca=Marca+B&min=100&max=200&orden=price-asc');
    const criteria = catalog.parseCatalogFilters(params);
    const first = await catalog.searchCatalog(db, criteria);
    assert.equal(first.total,30); assert.equal(first.products.length,24); assert.equal(first.products[0].skuId,'b00'); assert.equal(first.products[0].price,150);
    params.set('pagina','2'); const second=await catalog.searchCatalog(db,catalog.parseCatalogFilters(params));
    assert.equal(second.products.length,6); assert.equal(second.products[0].id,'24');
    params.delete('marca'); params.append('marca','Marca B'); params.set('pagina','1');
    const brand=await catalog.searchCatalog(db,catalog.parseCatalogFilters(params)); assert.equal(brand.total,15); assert.ok(brand.products.every(p=>p.brand==='Marca B'));
    params.set('q','inexistente'); assert.equal((await catalog.searchCatalog(db,catalog.parseCatalogFilters(params))).total,0);
    params.set('q','%'); assert.equal((await catalog.searchCatalog(db,catalog.parseCatalogFilters(params))).total,0);
  } finally { db.close(); }
});

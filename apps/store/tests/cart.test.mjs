import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createClient } from '@libsql/client';
const path = fileURLToPath(new URL('../src/cart.ts', import.meta.url));
const text = await readFile(path, 'utf8');
const code = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = new Module(path); mod.filename = path; mod.paths = Module._nodeModulePaths(fileURLToPath(new URL('../src/', import.meta.url))); mod._compile(code, path);
const { readCartSku, addToCart, cartStore } = mod.exports;
async function fixture() {
  const db = createClient({ url:'file::memory:' });
  await db.executeMultiple(`CREATE TABLE products(product_id TEXT, name TEXT); CREATE TABLE skus(sku_id TEXT, product_id TEXT, name TEXT, price REAL, stock INTEGER, images_json TEXT); INSERT INTO products VALUES('p','Producto'); INSERT INTO skus VALUES('s1','p','Azul',10,3,'[]'),('s2','p','Rojo',20,2,'[]'),('no-price','p','Sin precio',NULL,3,'[]'),('no-stock','p','Sin stock',10,0,'[]'),('unknown','p','Desconocido',10,NULL,'[]');`);
  cartStore.setState({items: []}); return db;
}
test('acumula por SKU, separa variantes y respeta el límite', async () => {
 const db=await fixture(); try {
  const one=await readCartSku(db,'p','s1'),two=await readCartSku(db,'p','s2');
  assert.equal((await addToCart(db,one,2)).ok,true); assert.equal((await addToCart(db,one,1)).ok,true);
  assert.equal((await addToCart(db,one,1)).ok,false); assert.equal((await addToCart(db,two,1)).ok,true);
  assert.deepEqual(cartStore.getState().items.map(x=>[x.skuId,x.quantity]),[['s1',3],['s2',1]]);
  for (const q of [0,-1,1.5,NaN]) assert.equal((await addToCart(db,two,q)).ok,false);
 } finally {db.close();}
});
test('rechaza precio, stock y datos cambiados sin alterar el carrito', async () => {
 const db=await fixture(); try {
  for (const id of ['no-price','no-stock','unknown']) assert.equal((await addToCart(db,await readCartSku(db,'p',id),1)).ok,false);
  const old=await readCartSku(db,'p','s1'); await db.execute("UPDATE skus SET price=11 WHERE sku_id='s1'");
  const result=await addToCart(db,old,1); assert.equal(result.ok,false); assert.match(result.message,/cambió/);
  assert.equal((await addToCart({execute:async()=>{throw Error('secreto');}},old,1)).ok,false);
  assert.deepEqual(cartStore.getState().items,[]);
 } finally {db.close();}
});
test('ignora pulsaciones concurrentes del mismo SKU', async () => {
 const db=await fixture(); try {
  const item=await readCartSku(db,'p','s1'); let release; const wait=new Promise(resolve=>{release=resolve;});
  const slow={execute:async (...args)=>{await wait;return db.execute(...args);}};
  const first=addToCart(slow,item,1), second=await addToCart(slow,item,1); assert.equal(second.ok,false); release(); assert.equal((await first).ok,true);
  assert.equal(cartStore.getState().items[0].quantity,1);
 } finally {db.close();}
});

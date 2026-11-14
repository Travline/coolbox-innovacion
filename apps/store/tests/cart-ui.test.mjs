import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Module from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><div id="root"></div>', {url:'http://localhost/'});
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const {createRoot} = await import('react-dom/client');
const {MemoryRouter} = await import('react-router-dom');
async function compile(name, transform = code => code) {
  const path = fileURLToPath(new URL(`../src/${name}`,import.meta.url));
  const source=await readFile(path,'utf8');
  const code=transform(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText);
  const mod=new Module(path); mod.filename=path; mod.paths=Module._nodeModulePaths(fileURLToPath(new URL('../src/',import.meta.url))); mod._compile(code,path); return mod.exports;
}
globalThis.__cartModule=await compile('cart.ts');
globalThis.__cartControl=await compile('AddToCart.tsx',code=>code.replace('require("./cart")','globalThis.__cartModule'));
const {RecommendationCards}=await compile('RecommendationCards.tsx',code=>code.replace('require("./AddToCart")','globalThis.__cartControl').replace('require("./recommendation-cards.css");',''));
const product={id:'p',name:'Laptop',brand:null,reference:null,descriptionHtml:null,descriptionText:null,specifications:{},skus:[{id:'s',name:'Azul',reference:null,images:[],price:10,listPrice:null,stock:2,sellerName:null}]};
globalThis.__detailFixture={loadProductDetail:async()=>product,selectDetailSku:()=>({sku:product.skus[0],invalid:false})};
const {ProductDetail}=await compile('ProductDetail.tsx',code=>code.replace('require("./AddToCart")','globalThis.__cartControl').replace('require("./product-detail")','globalThis.__detailFixture').replace('require("./product-detail.css");',''));
const db={execute:async()=>({rows:[{product_id:'p',product_name:'Laptop',sku_id:'s',sku_name:'Azul',price:10,stock:2,images_json:'[]'}]})};
const container=document.getElementById('root'), root=createRoot(container);
const click=async button=>React.act(async()=>{button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));});
test('el visitante agrega desde detalle y tarjeta con el mismo estado',async()=>{
 try {
  globalThis.__cartModule.cartStore.setState({items:[]});
  await React.act(async()=>{root.render(React.createElement(ProductDetail,{db,productId:'p',onBack:()=>{}}));});
  let button=[...container.querySelectorAll('button')].find(b=>b.textContent==='Agregar al carrito');
  assert.ok(button && !button.disabled); await click(button); assert.match(container.textContent,/Producto agregado al carrito/);
  await React.act(async()=>{root.render(React.createElement(MemoryRouter,null,React.createElement(RecommendationCards,{db,recommendations:[{productId:'p',skuId:'s',name:'Laptop',reason:'Marca',imageUrl:null,price:10}]})));});
  button=[...container.querySelectorAll('button')].find(b=>b.textContent==='Agregar al carrito');
  assert.ok(button && !button.disabled); await click(button); assert.match(container.textContent,/Producto agregado al carrito/);
  assert.equal(globalThis.__cartModule.cartStore.getState().items[0].quantity,2);
  await click(button); assert.match(container.textContent,/supera el stock/); assert.equal(globalThis.__cartModule.cartStore.getState().items[0].quantity,2);
 } finally {await React.act(async()=>root.unmount());dom.window.close();}
});

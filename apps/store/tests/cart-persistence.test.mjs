import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Module from 'node:module';
import ts from 'typescript';
const path=fileURLToPath(new URL('../src/cart.ts',import.meta.url));
const source=await readFile(path,'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod=new Module(path);mod.filename=path;mod.paths=Module._nodeModulePaths(fileURLToPath(new URL('../src/',import.meta.url)));mod._compile(code,path);
const {cartStore,restoreCart,persistCart,refreshCart,cartSubtotal,changeCartQuantity,removeCartItem}=mod.exports;
const item={productId:'p',skuId:'s',name:'Producto',variantName:null,imageUrl:null,price:10,stock:5,quantity:3};
const row=(price,stock)=>({product_id:'p',product_name:'Producto',sku_id:'s',sku_name:null,price,stock,images_json:'[]'});
const reset=()=>cartStore.setState({items:[],storageError:false,open:false,checking:false});
test('guarda, recupera sin verificar y tolera errores de lectura y escritura',()=>{
 reset();let value=null;const storage={getItem:()=>value,setItem:(_key,content)=>{value=content;}};const stop=persistCart(storage);
 cartStore.setState({items:[item]});assert.ok(value);stop();cartStore.setState({items:[]});restoreCart(storage);assert.equal(cartStore.getState().items[0].verification,'unverified');assert.equal(cartSubtotal(cartStore.getState().items),null);
 reset();restoreCart({getItem:()=>{throw Error('denied');},setItem:()=>{}});assert.equal(cartStore.getState().storageError,true);
 reset();const off=persistCart({getItem:()=>null,setItem:()=>{throw Error('denied');}});cartStore.setState({items:[item]});assert.equal(cartStore.getState().storageError,true);assert.equal(cartStore.getState().items.length,1);off();
});
test('actualiza datos, conserva cantidades excesivas y permite reducir o eliminar',async()=>{
 reset();cartStore.setState({items:[item]});await refreshCart({execute:async()=>({rows:[row(12,2)]})});const updated=cartStore.getState().items[0];assert.equal(updated.price,12);assert.equal(updated.quantity,3);assert.match(updated.notice,/precio cambió/i);assert.match(updated.notice,/cantidad supera/i);assert.equal(changeCartQuantity('s',4),false);assert.equal(changeCartQuantity('s',2),true);assert.doesNotMatch(cartStore.getState().items[0].notice,/cantidad supera/i);assert.equal(cartSubtotal(cartStore.getState().items),24);removeCartItem('s');assert.equal(cartStore.getState().items.length,0);
});
test('conserva selección y desconfirma subtotal para SKU ausente, datos incompletos y error',async()=>{
 for(const [rows,expected] of [[[],'missing'],[[row(null,2)],'unavailable']]){reset();cartStore.setState({items:[item]});await refreshCart({execute:async()=>({rows})});assert.equal(cartStore.getState().items[0].verification,expected);assert.equal(cartSubtotal(cartStore.getState().items),null);}
 reset();cartStore.setState({items:[item]});await refreshCart({execute:async()=>{throw Error('offline');}});assert.equal(cartStore.getState().items[0].verification,'unverified');assert.equal(changeCartQuantity('s',4),false);assert.equal(cartSubtotal(cartStore.getState().items),null);
});

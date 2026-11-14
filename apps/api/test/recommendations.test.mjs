import test from 'node:test';
import assert from 'node:assert/strict';
import { createChat } from '../dist/chat.js';

const product = { id:'p1', name:'Equipo existente', brand:'Marca', description:null, specifications:{}, categories:[], sku:{ id:'s1', name:'Variante', price:120, listPrice:130, stock:2, images:[{url:'javascript:alert(1)'},{url:'https://images.example.test/equipo.png'}], sellerName:null } };
test('tarjeta utiliza imagen, precio e identificadores recuperados y rechaza selección falsa', async () => {
  const emitted = [];
  const chat = createChat(async () => [product], async (_input, search, propose) => {
    await search({text:'equipo'});
    assert.equal(propose({productId:'inventado',evidence:{field:'name',value:'Equipo existente'}}), false);
    assert.equal(propose({productId:'p1',evidence:{field:'brand',value:'inventado'}}), false);
    assert.equal(propose({productId:'p1',evidence:{field:'name',value:'Equipo existente'}}), true);
    return {recommendations:[]};
  });
  const result = await chat({message:'equipo',history:[]}, item => emitted.push(item));
  assert.equal(result.status, 'ok');
  assert.deepEqual(emitted, [{productId:'p1',skuId:'s1',name:'Equipo existente',reason:'Producto: Equipo existente',imageUrl:'https://images.example.test/equipo.png',price:120}]);
});
test('datos de variante desconocidos o inválidos se representan como ausentes', async () => {
  const emitted=[];
  const chat=createChat(async()=>[{...product,sku:{...product.sku,images:[{url:'javascript:alert(1)'}],price:null}}],async(_input,search,propose)=>{await search({text:'equipo'});propose({productId:'p1',evidence:{field:'name',value:'Equipo existente'}});return {recommendations:[]};});
  await chat({message:'equipo',history:[]},item=>emitted.push(item));
  assert.equal(emitted[0].imageUrl,null);
  assert.equal(emitted[0].price,null);
});

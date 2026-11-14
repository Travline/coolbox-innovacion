import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/chat.ts', import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createChatProvider,beginChatTurn,appendChatFragment,finishChatTurn,retryChatTurn,initialChatSession}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const event=(type,body={})=>`data: ${JSON.stringify({type,...body})}\n\n`;
const item={productId:'p',skuId:'s',name:'Equipo',reason:'Marca: real',imageUrl:'https://images.example.test/p.png',price:120};
function response(data){return new Response(data,{headers:{'Content-Type':'text/event-stream'}});}
test('preserva tarjetas estructuradas en streaming completo y elimina datos extra del historial',async()=>{
  let session=beginChatTurn(initialChatSession,'equipo');
  const provider=createChatProvider('http://localhost',async()=>response(event('recommendation',{text:'un texto no confiable',recommendation:item})+event('done')));
  const text=await provider('equipo',[],(fragment,card)=>{session=appendChatFragment(session,fragment,card);});
  assert.equal(text,'Equipo — Marca: real');
  session=finishChatTurn(session,{ok:true,text});
  assert.deepEqual(session.messages[1].recommendations,[item]);
  assert.deepEqual(beginChatTurn(session,'otra consulta').attempt.history,[{role:'user',text:'equipo'},{role:'assistant',text:'Equipo — Marca: real'}]);
});
test('una respuesta interrumpida conserva tarjetas y el reintento comienza limpio',async()=>{
  let session=beginChatTurn(initialChatSession,'equipo');
  const provider=createChatProvider('http://localhost',async()=>response(event('recommendation',{text:'Equipo',recommendation:item})));
  await assert.rejects(provider('equipo',[],(fragment,card)=>{session=appendChatFragment(session,fragment,card);}));
  session=finishChatTurn(session,{ok:false});
  assert.equal(session.state,'incomplete');
  assert.deepEqual(session.partialRecommendations,[item]);
  session=retryChatTurn(session);
  assert.deepEqual(session.partialRecommendations,[]);
  assert.equal(session.messages.length,1);
});
test('rechaza tarjeta con identificadores o datos peligrosos',async()=>{
  for(const invalid of [{...item,productId:''},{...item,price:-1},{...item,imageUrl:'javascript:alert(1)'}]){
    const provider=createChatProvider('http://localhost',async()=>response(event('recommendation',{text:'Equipo',recommendation:invalid})+event('done')));
    await assert.rejects(provider('equipo',[]));
  }
});

test('acepta respuesta completa estructurada sin interpretar identificadores del texto',async()=>{
  let session=beginChatTurn(initialChatSession,'equipo');
  const provider=createChatProvider('http://localhost',async()=>new Response(JSON.stringify({status:'ok',text:'texto libre',recommendations:[item]}),{headers:{'Content-Type':'application/json'}}));
  const text=await provider('equipo',[],(fragment,card)=>{session=appendChatFragment(session,fragment,card);});
  assert.equal(text,'Equipo — Marca: real');
  assert.deepEqual(session.partialRecommendations,[item]);
});


test('conserva la hipótesis visible en tarjetas y contexto del siguiente turno',async()=>{
  const assumed={...item,assumptions:['El cable podría ser HDMI']};
  let session=beginChatTurn(initialChatSession,'necesito un cable');
  const provider=createChatProvider('http://localhost',async()=>response(event('recommendation',{text:'ignorado',recommendation:assumed})+event('done')));
  const text=await provider('necesito un cable',[],(fragment,card)=>{session=appendChatFragment(session,fragment,card);});
  assert.match(text,/Suposición para la búsqueda: El cable podría ser HDMI/);
  session=finishChatTurn(session,{ok:true,text});
  assert.deepEqual(session.messages[1].recommendations,[assumed]);
  assert.match(beginChatTurn(session,'sí').attempt.history[1].text,/Suposición/);
  const invalid={...item,assumptions:['x'.repeat(81)]};
  await assert.rejects(createChatProvider('http://localhost',async()=>response(event('recommendation',{text:'x',recommendation:invalid})+event('done')))('x',[]));
});

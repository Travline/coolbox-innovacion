import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createClient } from '@libsql/client';
import { readFile } from 'node:fs/promises';
import { answerService, createServiceSearch, serviceRequest } from '../dist/service.js';
import { createChat } from '../dist/chat.js';
import { streamChat } from '../dist/app.js';
import { MODEL_ID, EMBEDDING_VERSION } from '../dist/embedding.js';
const sample={sourceId:'certificado-garantia',chunkOrder:0,title:'Garantía',url:'https://www.coolbox.pe/certificado-de-garantia',checkedAt:'2025-01-01',heading:'Condiciones',applicability:'propio',content:'Condiciones completas y excepciones conservadas.'};
const request=(message,history=[])=>serviceRequest({message,history});
test('vendedor desconocido se aclara; respuesta posterior incorpora contexto sin arrastrar cambios de tema',async()=>{
  const first=await answerService(async()=>{throw new Error('no debe buscar');},request('¿Qué garantía tiene?'));
  assert.equal(first.status,'clarification');
  const next=request('Coolbox',[{role:'user',text:'¿Qué garantía tiene?'},{role:'assistant',text:first.text}]);
  assert.equal(next.seller,'propio');assert.ok(next.text.includes('garantía'));
  const decline=request('No sé',[{role:'user',text:'¿Qué garantía tiene?'},{role:'assistant',text:first.text}]);
  assert.equal((await answerService(async()=>{throw new Error('no buscar');},decline)).status,'no_results');
  assert.equal(request('Busco una laptop',[{role:'user',text:'¿Qué garantía tiene?'}]),null);
});
test('fragmentos completos, fecha, enlace y ámbito se validan; sin fecha o sin evidencia no se usan',async()=>{
  const req=request('garantía de producto propio');
  const result=await answerService(async()=>[sample,{...sample,sourceId:'falsa'},{...sample,checkedAt:''},{...sample,url:'https://evil.example/'},{...sample,applicability:'marketplace'}],req);
  assert.equal(result.status,'service');assert.equal(result.sources.length,1);assert.deepEqual(result.sources[0],sample);assert.match(result.text,/vigentes|vigencia/);
  const empty=await answerService(async()=>[{...sample,checkedAt:''}],req);assert.equal(empty.status,'no_results');
});
test('Marketplace, conflicto potencial y fallo técnico no generan afirmaciones categóricas',async()=>{
  const market={...sample,sourceId:'postventa-marketplace',applicability:'marketplace'};
  const result=await answerService(async()=>[sample,market],request('cambios de Marketplace'));
  assert.deepEqual(result.sources,[market]);assert.match(result.text,/diferencias/);
  await assert.rejects(answerService(async()=>{throw new Error('failure')},request('garantía producto propio')));
});
test('búsqueda usa vectores compatibles y únicamente lectura parametrizada',async()=>{
  const db=createClient({url:'file::memory:'});const v=Array(384).fill(0);v[0]=1;
  try{
    await db.executeMultiple(await readFile(new URL('../../../database/003_service_sources.sql',import.meta.url),'utf8'));
    await db.execute({sql:'INSERT INTO service_sources VALUES (?,?,?,?,?,?)',args:[sample.sourceId,sample.title,sample.url,sample.checkedAt,'v','2026']});
    await db.execute({sql:'INSERT INTO service_chunks VALUES (?,?,?,?,?,?,vector32(?),?,?)',args:[sample.sourceId,0,sample.heading,sample.applicability,sample.content,'v',JSON.stringify(v),MODEL_ID,`${EMBEDDING_VERSION}:service-v1`]});
    const search=createServiceSearch(db,async()=>v);const found=await search({text:'garantía',topics:['garantia'],seller:'propio'});assert.deepEqual(found,[sample]);
    assert.deepEqual(await search({text:'cambios',topics:['cambios'],seller:'propio'}),[]);
    await assert.rejects(search({text:'garantía',topics:['garantia'],seller:'propio',sql:'DELETE'}),{code:'INPUT'});
  }finally{db.close();}
});
class Response extends EventEmitter {constructor(){super();this.events=[];this.writableEnded=false;this.writableFinished=false;}status(){return this}set(){return this}flushHeaders(){}write(v){this.events.push(JSON.parse(v.slice(6)))}end(){this.writableEnded=true;this.writableFinished=true}json(){this.end()}}
test('stream transmite fuentes completas solo tras validar y diferencia fallo',async()=>{
  const res=new Response();const chat=createChat(async()=>[],undefined,async()=>[sample]);
  await streamChat(chat,{message:'garantía de producto propio',history:[]},res);
  assert.deepEqual(res.events.map((e)=>e.type),['activity','message','service_source','done']);assert.deepEqual(res.events[2].source,sample);
  const failed=new Response();await streamChat(createChat(async()=>[],undefined,async()=>{throw new Error('private')}),{message:'garantía de producto propio',history:[]},failed);assert.deepEqual(failed.events.map(e=>e.type),['activity','guidance','error']);assert.doesNotMatch(JSON.stringify(failed.events),/private/);
});

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { streamChat } from '../dist/app.js';
const input={message:'laptop',history:[]};
class MockResponse extends EventEmitter {
  constructor(){super();this.events=[];this.writableEnded=false;this.writableFinished=false;this.statusCode=200;}
  status(value){this.statusCode=value;return this;}
  set(){return this;}
  flushHeaders(){}
  write(value){this.events.push(JSON.parse(value.slice(6)));return true;}
  end(){this.writableEnded=true;this.writableFinished=true;}
  json(value){this.body=value;this.end();return this;}
}
const item=(id)=>({productId:id,skuId:null,name:id,reason:'Marca: A'});
test('actividad y dos recomendaciones verificadas preceden al final explícito',async()=>{
  const res=new MockResponse();
  await streamChat(async(_input,emit)=>{emit(item('uno')); assert.deepEqual(res.events.map(e=>e.type),['activity','recommendation']); await Promise.resolve();emit(item('dos')); return {status:'ok',text:'ok'};},input,res);
  assert.deepEqual(res.events.map(e=>e.type),['activity','recommendation','recommendation','done']);
});
test('sin resultados y fallos antes o después de un fragmento tienen eventos diferenciados',async()=>{
  for (const after of [false,true]) {
    const res=new MockResponse();
    await streamChat(async(_input,emit)=>{if(after)emit(item('uno'));throw new Error('detalle secreto');},input,res);
    assert.deepEqual(res.events.map(e=>e.type),after?['activity','recommendation','guidance','error']:['activity','guidance','error']);
    assert.doesNotMatch(JSON.stringify(res.events),/detalle secreto/);
  }
  const res=new MockResponse();
  await streamChat(async()=>({status:'no_results',text:'Sin resultados'}),input,res);
  assert.deepEqual(res.events.map(e=>e.type),['activity','no_results','guidance','done']);
});
test('desconexión cancela el trabajo y no transmite fragmentos posteriores',async()=>{
  const res=new MockResponse();
  await streamChat(async(_input,emit,signal)=>{emit(item('uno'));res.emit('close');assert.equal(signal.aborted,true);emit(item('dos'));return {status:'ok',text:'ok'};},input,res);
  assert.deepEqual(res.events.map(e=>e.type),['activity','recommendation']);
});

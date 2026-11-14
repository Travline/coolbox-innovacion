import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
const path=fileURLToPath(new URL('../src/chat.ts',import.meta.url));
const code=ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createChatProvider,initialChatSession,beginChatTurn,appendChatFragment,finishChatTurn,retryChatTurn}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const event=(type,body={})=>`data: ${JSON.stringify({type,...body})}\n\n`;
const source={sourceId:'garantia',chunkOrder:1,title:'Certificado de garantía',url:'https://www.coolbox.pe/certificado-de-garantia',checkedAt:'2025-01-01',heading:'Condiciones',applicability:'propio',content:'Condición completa con excepción.'};
const response=(text)=>new Response(text,{headers:{'content-type':'text/event-stream'}});
test('fuentes oficiales con fecha viajan completas y permanecen en el mensaje final',async()=>{
  let session=beginChatTurn(initialChatSession,'garantía');
  const provider=createChatProvider('http://localhost',async()=>response(event('message',{text:'No puedo confirmar vigencia.'})+event('service_source',{source})+event('done')));
  const text=await provider('garantía',[],(fragment,card,item)=>{session=appendChatFragment(session,fragment,card,item);});
  session=finishChatTurn(session,{ok:true,text});
  assert.equal(session.messages[1].text,'No puedo confirmar vigencia.');assert.deepEqual(session.messages[1].sources,[source]);
  assert.deepEqual(beginChatTurn(session,'otra').attempt.history,[{role:'user',text:'garantía'},{role:'assistant',text:'No puedo confirmar vigencia.'}]);
});
test('interrupción conserva fuentes verificadas y el reintento no las mezcla',async()=>{
  let session=beginChatTurn(initialChatSession,'garantía');
  const provider=createChatProvider('http://localhost',async()=>response(event('message',{text:'No puedo confirmar vigencia.'})+event('service_source',{source})));
  await assert.rejects(provider('garantía',[],(fragment,card,item)=>{session=appendChatFragment(session,fragment,card,item);}));
  session=finishChatTurn(session,{ok:false});assert.equal(session.state,'incomplete');assert.deepEqual(session.partialSources,[source]);
  session=retryChatTurn(session);assert.deepEqual(session.partialSources,[]);assert.equal(session.messages.length,1);
});
test('rechaza fuente sin fecha o con enlace peligroso',async()=>{
  for (const invalid of [{...source,checkedAt:''},{...source,url:'javascript:alert(1)'},{...source,url:'https://evil.example/'},{...source,checkedAt:'2099-01-01'}]) {
    const provider=createChatProvider('http://localhost',async()=>response(event('message',{text:'Advertencia'})+event('service_source',{source:invalid})+event('done')));
    await assert.rejects(provider('garantía',[]));
  }
});
const componentPath=fileURLToPath(new URL('../src/ServiceSources.tsx',import.meta.url));
const componentCode=ts.transpileModule((await readFile(componentPath,'utf8')).replace("import './service-sources.css';",''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const componentModule=new Module(componentPath);componentModule.filename=componentPath;componentModule.paths=Module._nodeModulePaths(fileURLToPath(new URL('../src/',import.meta.url)));componentModule._compile(componentCode,componentPath);const {ServiceSources}=componentModule.exports;
test('presenta fragmento como texto y enlace oficial con fecha',async()=>{
  const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/'});const old={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT};globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const container=dom.window.document.getElementById('root');const root=createRoot(container);
  try {await act(async()=>root.render(React.createElement(ServiceSources,{sources:[{...source,content:'<script>alert(1)</script>'}]})));assert.match(container.textContent,/Condiciones/);assert.match(container.textContent,/2025-01-01/);assert.equal(container.querySelector('a').getAttribute('href'),source.url);assert.equal(container.querySelector('script'),null);assert.match(container.textContent,/<script>/);}finally{await act(async()=>root.unmount());dom.window.close();globalThis.window=old.window;globalThis.document=old.document;globalThis.IS_REACT_ACT_ENVIRONMENT=old.act;}
});

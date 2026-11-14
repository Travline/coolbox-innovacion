import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
const chatSource=await readFile(new URL('../src/chat.ts',import.meta.url),'utf8');
const code=ts.transpileModule(chatSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createChatProvider,initialChatSession,beginChatTurn,appendChatFragment,finishChatTurn,retryChatTurn}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const sourceUrl='https://www.coolbox.pe/canales-de-atencion';
const event=(type,body={})=>`data: ${JSON.stringify({type,...body})}\n\n`;
const response=(body)=>new Response(body,{headers:{'content-type':'text/event-stream'}});
const empty={sourceUrl,checkedAt:null,whatsapp:null,email:null};
test('sin resultados conserva orientación oficial y un fallo conserva reintento',async()=>{
  let session=beginChatTurn(initialChatSession,'consulta');
  const provider=createChatProvider('http://localhost',async()=>response(event('no_results',{text:'No encontré evidencia.'})+event('guidance',{guidance:empty})+event('done')));
  const receive=(text,card,source,guidance)=>{session=appendChatFragment(session,text,card,source,guidance);};
  const text=await provider('consulta',[],receive);session=finishChatTurn(session,{ok:true,text});
  assert.deepEqual(session.messages[1].guidance,empty);assert.match(session.messages[1].text,/evidencia/);
  session=beginChatTurn(session,'otra');
  const failing=createChatProvider('http://localhost',async()=>response(event('guidance',{guidance:empty})+event('error')));
  await assert.rejects(failing('otra',[],receive));session=finishChatTurn(session,{ok:false});
  assert.equal(session.state,'error');assert.deepEqual(session.partialGuidance,empty);
  session=retryChatTurn(session);assert.equal(session.partialGuidance,null);assert.equal(session.messages.length,3);
});
test('rechaza datos de contacto de una fuente falsa',async()=>{
 let received;
 const provider=createChatProvider('http://localhost',async()=>response(event('no_results',{text:'Sin evidencia'})+event('guidance',{guidance:{sourceUrl:'https://evil.test',checkedAt:'2026-11-13',whatsapp:'123456789',email:'x@example.test'}})+event('done')));
 await provider('consulta',[],(_text,_card,_source,guidance)=>{if(guidance)received=guidance;});
 assert.deepEqual(received,empty);
});
const componentPath=fileURLToPath(new URL('../src/ContactGuidance.tsx',import.meta.url));
const componentSource=(await readFile(componentPath,'utf8')).replace("import { CONTACT_SOURCE } from './chat';",`const CONTACT_SOURCE = '${sourceUrl}';`);
const componentCode=ts.transpileModule(componentSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const componentModule=new Module(componentPath);componentModule.filename=componentPath;componentModule.paths=Module._nodeModulePaths(fileURLToPath(new URL('../src/',import.meta.url)));componentModule._compile(componentCode,componentPath);const {ContactGuidance}=componentModule.exports;
test('muestra enlaces solo con revisión del día y alternativa si falta o caduca',async()=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/'});const old={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT};globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const root=createRoot(dom.window.document.getElementById('root'));
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=t=>parts.find(p=>p.type===t).value;const today=`${get('year')}-${get('month')}-${get('day')}`;
 try{await act(async()=>root.render(React.createElement(ContactGuidance,{guidance:{sourceUrl,checkedAt:today,whatsapp:'51966032014',email:'atencion@example.test'}})));
  assert.equal(dom.window.document.querySelector('a[href="https://wa.me/51966032014"]')?.textContent,'WhatsApp: 51966032014');assert.ok(dom.window.document.querySelector('a[href="mailto:atencion@example.test"]'));
  await act(async()=>root.render(React.createElement(ContactGuidance,{guidance:{sourceUrl,checkedAt:'2020-01-01',whatsapp:'51966032014',email:'atencion@example.test'}})));
  assert.equal(dom.window.document.querySelector('a[href^="https://wa.me/"]'),null);assert.equal(dom.window.document.querySelector('a[href^="mailto:"]'),null);assert.ok(dom.window.document.querySelector(`a[href="${sourceUrl}"]`));
 }finally{await act(async()=>root.unmount());dom.window.close();globalThis.window=old.window;globalThis.document=old.document;globalThis.IS_REACT_ACT_ENVIRONMENT=old.act;}
});

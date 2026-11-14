import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Module from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.HTMLElement=dom.window.HTMLElement;
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react');const {createRoot}=await import('react-dom/client');
async function compile(name,transform=code=>code){const path=fileURLToPath(new URL(`../src/${name}`,import.meta.url));const source=await readFile(path,'utf8');const code=transform(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText);const mod=new Module(path);mod.filename=path;mod.paths=Module._nodeModulePaths(fileURLToPath(new URL('../src/',import.meta.url)));mod._compile(code,path);return mod.exports;}
globalThis.__cart=await compile('cart.ts');globalThis.__catalog={connect:()=>({execute:async()=>({rows:[]})})};
const {CartPanel}=await compile('CartPanel.tsx',code=>code.replace('require("./cart")','globalThis.__cart').replace('require("./catalog")','globalThis.__catalog').replace('require("./cart-panel.css");',''));
const root=createRoot(document.getElementById('root'));
test('panel vacío, foco, cierre con Escape y retorno al botón',async()=>{
 try{await React.act(async()=>root.render(React.createElement(React.Fragment,null,React.createElement('button',{id:'open',onClick:()=>globalThis.__cart.cartStore.setState({open:true})},'Abrir'),React.createElement(CartPanel))));const trigger=document.getElementById('open');trigger.focus();await React.act(async()=>trigger.click());assert.match(document.body.textContent,/Tu carrito está vacío/);assert.equal(document.activeElement.getAttribute('aria-label'),'Cerrar carrito');const panel=document.querySelector('[role=dialog]');await React.act(async()=>panel.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(document.querySelector('[role=dialog]'),null);assert.equal(document.activeElement,trigger);
 }finally{await React.act(async()=>root.unmount());dom.window.close();}
});

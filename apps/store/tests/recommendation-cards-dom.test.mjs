import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

const file = fileURLToPath(new URL('../src/RecommendationCards.tsx', import.meta.url));
const source = (await readFile(file, 'utf8')).replace("import './recommendation-cards.css';", '');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText.replace('require("./AddToCart")', '{ AddToCart: () => null }');
const componentModule = new Module(file);
componentModule.filename = file;
componentModule.paths = Module._nodeModulePaths(fileURLToPath(new URL('../src/', import.meta.url)));
componentModule._compile(code, file);
const { RecommendationCards } = componentModule.exports;

const first = { productId:'p1', skuId:'s1', name:'Primer producto', reason:'Marca: Uno', imageUrl:'https://images.example.test/one.png', price:125 };
const second = { productId:'p 2', skuId:null, name:'Producto segundo con un nombre largo', reason:'Categoría: Audio', imageUrl:null, price:null };
const third = { productId:'p3', skuId:'s3', name:'Tercer producto', reason:'Marca: Tres', imageUrl:null, price:10 };

test('tarjetas: navegación accesible, resultados añadidos y datos ausentes', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url:'http://localhost/' });
  const previous = { window:globalThis.window, document:globalThis.document, navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator'), act:globalThis.IS_REACT_ACT_ENVIRONMENT };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis,'navigator',{ value:dom.window.navigator, configurable:true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = dom.window.document.getElementById('root');
  const root = createRoot(container);
  const render = async cards => { await act(async () => root.render(React.createElement(MemoryRouter,null,React.createElement(RecommendationCards,{recommendations:cards})))); };
  const click = async button => { await act(async () => button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}))); };
  try {
    await render([]);
    assert.equal(container.querySelector('[aria-label="Productos recomendados"]'), null);
    await render([first]);
    assert.match(container.textContent, /Primer producto/);
    assert.match(container.textContent, /S\/ 125\.00/);
    assert.equal(container.querySelector('[aria-label="Producto anterior"]').disabled, true);
    assert.equal(container.querySelector('[aria-label="Producto siguiente"]').disabled, true);
    assert.equal(container.querySelector('a').getAttribute('href'), '/producto/p1?sku=s1');
    const longName = 'Audífonos bluetooth True Wireless con cancelación de ruido y batería de larga duración';
    await render([{...first, name: longName, reason: `Producto: ${longName}`}]);
    const heading = container.querySelector('h3');
    assert.ok(Array.from(heading.textContent).length <= 45);
    assert.ok(heading.textContent.endsWith('...'));
    assert.equal(heading.getAttribute('title'), longName);
    assert.equal(heading.getAttribute('aria-label'), longName);
    assert.ok(container.textContent.includes(`Producto: ${heading.textContent}`));
    await render([{...first, assumptions:['El cable podría ser HDMI']}]);
    assert.match(container.textContent, /Suposición para la búsqueda: El cable podría ser HDMI/);
    assert.match(container.textContent, /Comprueba la compatibilidad/);
    await render([first,second]);
    await click(container.querySelector('[aria-label="Producto siguiente"]'));
    assert.match(container.textContent, /Producto segundo con un nombre largo/);
    assert.match(container.textContent, /Imagen no disponible/);
    assert.match(container.textContent, /Precio no disponible/);
    assert.equal(container.querySelector('a').getAttribute('href'), '/producto/p%202');
    assert.match(container.querySelector('[aria-live="polite"]').textContent, /2 de 2/);
    await render([first,second,third]);
    assert.match(container.textContent, /Producto segundo con un nombre largo/);
    assert.match(container.querySelector('[aria-live="polite"]').textContent, /2 de 3/);
    await click(container.querySelector('[aria-label="Producto anterior"]'));
    const image = container.querySelector('img');
    assert.ok(image);
    await act(async () => image.dispatchEvent(new dom.window.Event('error')));
    assert.match(container.textContent, /Imagen no disponible/);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    if (previous.navigator) Object.defineProperty(globalThis,'navigator',previous.navigator); else delete globalThis.navigator;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous.act;
  }
});

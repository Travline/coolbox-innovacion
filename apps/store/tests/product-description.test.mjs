import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://store.example.test/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const jsxRuntime = await import('react/jsx-runtime');
const { createRoot } = await import('react-dom/client');
const createDOMPurify = (await import('dompurify')).default;
const purifier = typeof createDOMPurify.sanitize === 'function' ? createDOMPurify : createDOMPurify(dom.window);
let currentProduct;
globalThis.__hu10TestDependencies = {
  React, jsxRuntime, purifier,
  loadProductDetail: async () => currentProduct,
  selectDetailSku: () => ({ sku: null, invalid: false })
};
const source = await readFile(new URL('../src/ProductDetail.tsx', import.meta.url), 'utf8');
let compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
// Use the actual component and DOMPurify; substitute module resolution for the data URL and the database boundary.
compiled = compiled
  .replace('import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";', 'const { jsx: _jsx, jsxs: _jsxs } = globalThis.__hu10TestDependencies.jsxRuntime;')
  .replace("import { useEffect, useMemo, useState } from 'react';", 'const { useEffect, useMemo, useState } = globalThis.__hu10TestDependencies.React;')
  .replace("import DOMPurify from 'dompurify';", 'const DOMPurify = globalThis.__hu10TestDependencies.purifier;')
  .replace("import { AddToCart } from './AddToCart';", 'const AddToCart = () => null;')
  .replace("import { loadProductDetail, selectDetailSku } from './product-detail';", 'const { loadProductDetail, selectDetailSku } = globalThis.__hu10TestDependencies;')
  .replace("import './product-detail.css';", '');
const { ProductDetail, sanitizeDescription } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const product = { id:'p1', name:'Producto', brand:null, reference:null, descriptionHtml:null, descriptionText:null, specifications:{}, skus:[] };

test('DOMPurify conserva formato seguro y elimina scripts, eventos y enlaces peligrosos', () => {
  const html = sanitizeDescription('<p onclick="alert(1)">Contenido <strong>importante</strong></p><ul><li>Uno</li></ul><script>alert(1)</script><a href="javascript:alert(1)" onmouseover="alert(1)">Enlace</a><img src=x onerror="alert(1)">');
  const container = document.createElement('div');
  container.innerHTML = html;
  assert.equal(container.querySelector('p strong')?.textContent, 'importante');
  assert.equal(container.querySelector('ul li')?.textContent, 'Uno');
  assert.equal(container.querySelector('script, img, a'), null);
  assert.equal(container.querySelector('[onclick], [onmouseover], [onerror], [href]'), null);
  assert.match(container.textContent, /Enlace/);
  assert.doesNotMatch(container.textContent, /alert\(1\)/);
});

test('la descripción usa texto alternativo si el HTML sanitizado queda sin contenido', async () => {
  const element = document.getElementById('root');
  const root = createRoot(element);
  try {
    currentProduct = { ...product, descriptionHtml: '<script>alert(1)</script><img src=x onerror="alert(2)">', descriptionText: 'Descripción de respaldo' };
    await React.act(async () => { root.render(React.createElement(ProductDetail, { db: {}, productId:'p1', onBack:() => {} })); });
    assert.match(element.textContent, /Descripción de respaldo/);
    assert.equal(element.querySelector('script, img'), null);
    currentProduct = { ...product, descriptionHtml: '<p> </p>', descriptionText: null };
    await React.act(async () => { root.render(React.createElement(ProductDetail, { db: {}, productId:'p2', onBack:() => {} })); });
    assert.match(element.textContent, /Descripción no disponible/);
  } finally {
    await React.act(async () => { root.unmount(); });
  }
});

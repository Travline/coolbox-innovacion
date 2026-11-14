import test from 'node:test';
import assert from 'node:assert/strict';
import { createCors } from '../dist/app.js';

function request(configured, method, origin) {
  const headers = {};
  let status = null, next = false;
  const response = {
    vary: (value) => { headers.vary = value; },
    setHeader: (name, value) => { headers[name.toLowerCase()] = value; },
    sendStatus: (value) => { status = value; }
  };
  createCors(configured)({ method, headers: { origin } }, response, () => { next = true; });
  return { headers, status, next };
}

test('orígenes locales por defecto admiten preflight y reflejan solamente el origen solicitado', () => {
  for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173']) {
    const result = request(undefined, 'OPTIONS', origin);
    assert.equal(result.status, 204);
    assert.equal(result.headers['access-control-allow-origin'], origin);
    assert.equal(result.headers['access-control-allow-methods'], 'GET, POST, OPTIONS');
    assert.equal(result.headers.vary, 'Origin');
  }
});

test('lista explícita separada por comas bloquea otros orígenes y comodines', () => {
  const configured = 'https://tienda.example, http://localhost:4173, *, https://host.example/path';
  assert.equal(request(configured, 'OPTIONS', 'https://tienda.example').status, 204);
  const post = request(configured, 'POST', 'http://localhost:4173');
  assert.equal(post.headers['access-control-allow-origin'], 'http://localhost:4173');
  assert.equal(post.next, true);
  for (const origin of ['https://invasor.example', '*', 'http://127.0.0.1:4173', 'https://host.example']) {
    const result = request(configured, 'OPTIONS', origin);
    assert.equal(result.status, 403);
    assert.equal(result.headers['access-control-allow-origin'], undefined);
    assert.equal(result.headers.vary, 'Origin');
  }
});

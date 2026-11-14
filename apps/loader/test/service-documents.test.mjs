import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';
import { prepareSource, saveSource, validateSource } from '../service-documents.js';
import { MODEL_ID, MODEL_REVISION, EMBEDDING_VERSION } from '../catalog.js';

const date = new Date('2026-11-13T12:00:00Z');
const makeSource = (id, title = id) => ({ id, title, sourceUrl: `https://www.coolbox.pe/${id}`, checkedAt: '2026-11-13', reviewed: true, sections: [
  { heading: 'Condiciones', applicability: 'propio', content: 'La condición incluye su excepción.' },
  { heading: 'Marketplace', applicability: 'marketplace', content: 'Consulte la política del vendedor.' }
] });
const vector = [1, ...Array(383).fill(0)];
function extractor(text, options) {
  assert.ok(text.startsWith('passage: Fuente: '));
  assert.deepEqual(options, { pooling: 'mean', normalize: true });
  return Promise.resolve({ data: vector });
}
extractor.tokenizer = async (text, options) => {
  assert.deepEqual(options, { truncation: false, padding: false });
  return { input_ids: { data: Array(text.length > 1000 ? 513 : 20).fill(1) } };
};
async function database() {
  const db = createClient({ url: 'file::memory:' });
  for (const name of ['001_initial.sql', '002_embedding_hash.sql', '003_service_sources.sql']) {
    await db.executeMultiple(await readFile(new URL(`../../../database/${name}`, import.meta.url), 'utf8'));
  }
  await db.execute("INSERT INTO products (product_id,name,specifications_json,extracted_at,updated_at) VALUES ('p','producto','{}','2026-01-01','2026-01-01')");
  await db.execute("INSERT INTO service_documents (document_id,title,source_url,content,source_checked_at,updated_at) VALUES (1,'anterior','https://example.org','texto','2026-01-01','2026-01-01')");
  return db;
}

test('valida fuente oficial, fecha y revisión, conserva contexto y rechaza exceso antes de escribir', async () => {
  const input = makeSource('garantia');
  const prepared = await prepareSource(input, extractor, date);
  assert.equal(prepared.chunks.length, 2);
  assert.equal(prepared.chunks[0].content, input.sections[0].content);
  assert.equal(prepared.chunks[1].applicability, 'marketplace');
  assert.match(prepared.source.versionHash, /^[a-f0-9]{64}$/);
  assert.throws(() => validateSource({ ...input, reviewed: false }, date));
  assert.throws(() => validateSource({ ...input, checkedAt: '2026-02-30' }, date));
  assert.throws(() => validateSource({ ...input, sourceUrl: 'https://example.org/' }, date));
  assert.throws(() => validateSource({ ...input, checkedAt: '2026-11-14' }, date));
  const long = makeSource('larga'); long.sections[0].content = 'condición '.repeat(300);
  await assert.rejects(prepareSource(long, extractor, date), /excede/);
  assert.equal(MODEL_ID, 'Xenova/multilingual-e5-small');
  assert.equal(MODEL_REVISION, '761b726dd34fb83930e26aab4e9ac3899aa1fa78');
  assert.match(EMBEDDING_VERSION, /fp32:mean:l2/);
});

test('cargas repetidas, fallo transaccional y actualización conservan otras fuentes y productos', async () => {
  const db = await database();
  try {
    const first = await prepareSource(makeSource('fuente-uno'), extractor, date);
    const other = await prepareSource(makeSource('fuente-dos'), extractor, date);
    await saveSource(db, first, '2026-11-13T12:00:00Z');
    await saveSource(db, other, '2026-11-13T12:00:00Z');
    await saveSource(db, first, '2026-11-13T12:00:00Z');
    let rows = await db.execute("SELECT chunk_order,content,embedding_model,embedding_version FROM service_chunks WHERE source_id='fuente-uno' ORDER BY chunk_order");
    assert.equal(rows.rows.length, 2);
    assert.equal(rows.rows[1].chunk_order, 1);
    assert.equal(rows.rows[0].embedding_model, MODEL_ID);
    assert.match(rows.rows[0].embedding_version, /service-v1$/);
    const changed = makeSource('fuente-uno', 'Nuevo título'); changed.sections[0].content = 'Condición actualizada.';
    const next = await prepareSource(changed, extractor, date);
    next.chunks[1].order = 0;
    await assert.rejects(saveSource(db, next));
    assert.equal((await db.execute("SELECT title FROM service_sources WHERE source_id='fuente-uno'")).rows[0].title, 'fuente-uno');
    assert.equal((await db.execute("SELECT COUNT(*) n FROM service_chunks WHERE source_id='fuente-uno'")).rows[0].n, 2);
    next.chunks[1].order = 1;
    await saveSource(db, next, '2026-11-13T12:01:00Z');
    assert.equal((await db.execute("SELECT content FROM service_chunks WHERE source_id='fuente-uno' AND chunk_order=0")).rows[0].content, 'Condición actualizada.');
    assert.equal((await db.execute("SELECT COUNT(*) n FROM service_chunks WHERE source_id='fuente-dos'")).rows[0].n, 2);
    assert.equal((await db.execute('SELECT COUNT(*) n FROM products')).rows[0].n, 1);
    assert.equal((await db.execute('SELECT COUNT(*) n FROM service_documents')).rows[0].n, 1);
  } finally { db.close(); }
});

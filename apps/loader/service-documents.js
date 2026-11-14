import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createClient } from '@libsql/client';
import { pipeline, env } from '@huggingface/transformers';
import { MODEL_ID, MODEL_REVISION, EMBEDDING_VERSION, validateVector } from './catalog.js';

const DOCUMENT_VERSION = `${EMBEDDING_VERSION}:service-v1`;
const MAX_TOKENS = 512;
const APPLICABILITY = new Set(['propio', 'marketplace', 'ambos', 'indeterminado']);
const text = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} debe ser texto no vacío`);
  return value.trim();
};

// Sections are manually bounded to keep conditions and exceptions together. Never split silently.
export function validateSource(input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Fuente inválida');
  const id = text(input.id, 'id');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || id.length > 80) throw new Error('id inválido');
  const title = text(input.title, 'title');
  const sourceUrl = text(input.sourceUrl, 'sourceUrl');
  let url;
  try { url = new URL(sourceUrl); } catch { throw new Error('URL inválida'); }
  if (url.protocol !== 'https:' || url.hostname !== 'www.coolbox.pe' || url.username || url.password || url.hash || url.search) throw new Error('La fuente debe ser una URL oficial de Coolbox');
  const checkedAt = text(input.checkedAt, 'checkedAt');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkedAt) || Number.isNaN(Date.parse(`${checkedAt}T00:00:00Z`)) || new Date(`${checkedAt}T00:00:00Z`).toISOString().slice(0, 10) !== checkedAt || checkedAt > now.toISOString().slice(0, 10)) throw new Error('Fecha de revisión inválida');
  if (input.reviewed !== true) throw new Error('La fuente debe revisarse y aprobarse manualmente antes de cargar');
  if (!Array.isArray(input.sections) || !input.sections.length || input.sections.length > 200) throw new Error('Se requieren secciones revisadas');
  const sections = input.sections.map((section) => {
    if (!section || typeof section !== 'object') throw new Error('Sección inválida');
    const heading = text(section.heading, 'heading');
    const content = text(section.content, 'content');
    const applicability = text(section.applicability, 'applicability');
    if (!APPLICABILITY.has(applicability)) throw new Error('Ámbito inválido');
    return { heading, content, applicability };
  });
  const value = { id, title, sourceUrl, checkedAt, sections };
  return { ...value, versionHash: createHash('sha256').update(JSON.stringify(value)).digest('hex') };
}

export function passageForSection(source, section) {
  return `passage: Fuente: ${source.title}\nÁmbito: ${section.applicability}\nSección: ${section.heading}\n${section.content}`;
}

export async function prepareSource(input, extractor, now) {
  const source = validateSource(input, now);
  const chunks = [];
  for (const [order, section] of source.sections.entries()) {
    const passage = passageForSection(source, section);
    // Explicitly disable tokenizer truncation so the count includes all text and special tokens.
    const tokens = await extractor.tokenizer(passage, { truncation: false, padding: false });
    if (!tokens?.input_ids?.data || tokens.input_ids.data.length > MAX_TOKENS) throw new Error(`Sección ${order + 1} excede ${MAX_TOKENS} tokens; divídela manualmente conservando el contexto`);
    const output = await extractor(passage, { pooling: 'mean', normalize: true });
    chunks.push({ ...section, order, embedding: validateVector(output.data) });
  }
  return { source, chunks };
}

export async function saveSource(client, prepared, now = new Date().toISOString()) {
  const { source, chunks } = prepared;
  if (!source || !Array.isArray(chunks) || chunks.length !== source.sections.length || !chunks.length) throw new Error('Fuente preparada incompleta');
  const statement = (sql, args = []) => ({ sql, args });
  const statements = [statement(`INSERT INTO service_sources (source_id,title,source_url,source_checked_at,version_hash,updated_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(source_id) DO UPDATE SET title=excluded.title, source_url=excluded.source_url, source_checked_at=excluded.source_checked_at, version_hash=excluded.version_hash, updated_at=excluded.updated_at`, [source.id, source.title, source.sourceUrl, source.checkedAt, source.versionHash, now]),
  statement('DELETE FROM service_chunks WHERE source_id = ?', [source.id])];
  for (const chunk of chunks) {
    validateVector(chunk.embedding);
    statements.push(statement(`INSERT INTO service_chunks (source_id,chunk_order,heading,applicability,content,version_hash,embedding,embedding_model,embedding_version) VALUES (?,?,?,?,?,?,vector32(?),?,?)`, [source.id, chunk.order, chunk.heading, chunk.applicability, chunk.content, source.versionHash, JSON.stringify(chunk.embedding), MODEL_ID, DOCUMENT_VERSION]));
  }
  await client.batch(statements, 'write');
}

async function run() {
  const validateOnly = process.argv[2] === '--validate-only';
  const path = process.argv[validateOnly ? 3 : 2];
  if (!path || process.argv.length !== (validateOnly ? 4 : 3)) throw new Error('Indica la ruta a una fuente JSON revisada');
  const source = JSON.parse(await readFile(resolve(path), 'utf8'));
  // Validation precedes model loading and any database access.
  validateSource(source);
  env.cacheDir = fileURLToPath(new URL('./.cache/', import.meta.url));
  const extractor = await pipeline('feature-extraction', MODEL_ID, { revision: MODEL_REVISION, dtype: 'fp32', device: 'cpu' });
  const prepared = await prepareSource(source, extractor);
  if (validateOnly) { console.log(`Fuente preparada: ${prepared.source.id}; fragmentos: ${prepared.chunks.length}`); return; }
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('Configura TURSO_DATABASE_URL y TURSO_AUTH_TOKEN');
  const client = createClient({ url, authToken });
  try { await saveSource(client, prepared); } finally { client.close(); }
  console.log(`Fuente actualizada: ${prepared.source.id}; fragmentos: ${prepared.chunks.length}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run().catch(() => { console.error('No se pudo preparar o cargar la fuente. Verifica el archivo, el esquema y la configuración; no se registra el error sensible.'); process.exitCode = 1; });
}

import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createClient } from '@libsql/client';
import { pipeline, env } from '@huggingface/transformers';
import { MODEL_ID, MODEL_REVISION, EMBEDDING_VERSION, validateCatalog, passageFor, embeddingHash, validateVector } from './catalog.js';

const catalogPath = fileURLToPath(new URL('../scrapper/coolbox_productos.json', import.meta.url));
env.cacheDir = fileURLToPath(new URL('./.cache/', import.meta.url));
const statement = (sql, args = []) => ({ sql, args });

export function describeError(error, secrets = []) {
  const result = [];
  const seen = new Set();
  for (let current = error; current && !seen.has(current) && result.length < 3; current = current.cause) {
    seen.add(current);
    const code = typeof current.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(current.code) && !secrets.some((secret) => secret && current.code.includes(secret)) ? current.code : '';
    let message = typeof current.message === 'string' ? current.message : String(current);
    for (const secret of secrets) if (secret) message = message.split(secret).join('[oculto]');
    message = message.replace(/\b(?:https?|libsql|wss?):\/\/[^\s]+/gi, '[URL oculta]')
      .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [oculto]')
      .replace(/[\r\n]+/g, ' ').slice(0, 500);
    const detail = `${code ? `${code}: ` : ''}${message}`;
    if (!result.includes(detail)) result.push(detail);
  }
  return result.join(' | causa: ') || 'Error desconocido';
}


export async function saveProduct(client, product, hash, vector, now) {
  const embeddingSql = vector ? 'vector32(?)' : '(SELECT embedding FROM products WHERE product_id = ?)';
  const embeddingArg = vector ? JSON.stringify(vector) : product.productId;
  const statements = [statement(`INSERT INTO products (product_id, name, brand, reference, slug, source_url, description_html, description_text, specifications_json, embedding, embedding_model, embedding_version, embedding_hash, extracted_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${embeddingSql}, ?, ?, ?, ?, ?)
    ON CONFLICT(product_id) DO UPDATE SET name=excluded.name, brand=excluded.brand, reference=excluded.reference, slug=excluded.slug, source_url=excluded.source_url, description_html=excluded.description_html, description_text=excluded.description_text, specifications_json=excluded.specifications_json, embedding=excluded.embedding, embedding_model=excluded.embedding_model, embedding_version=excluded.embedding_version, embedding_hash=excluded.embedding_hash, extracted_at=excluded.extracted_at, updated_at=excluded.updated_at`,
  [product.productId, product.name, product.brand, product.reference, product.slug, product.sourceUrl, product.descriptionHtml, product.descriptionText, JSON.stringify(product.specifications), embeddingArg, MODEL_ID, EMBEDDING_VERSION, hash, product.extractedAt, now])];
  statements.push(statement('DELETE FROM product_categories WHERE product_id = ?', [product.productId]));
  for (const category of product.categories) {
    statements.push(statement('INSERT INTO categories (category_id, name, path) VALUES (?, ?, ?) ON CONFLICT(category_id) DO UPDATE SET name=excluded.name, path=COALESCE(excluded.path, categories.path)', [category.id, category.name, category.path]));
    statements.push(statement('INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)', [product.productId, category.id]));
  }
  // A complete source product replaces its SKU set, while other products remain untouched.
  statements.push(statement('DELETE FROM skus WHERE product_id = ?', [product.productId]));
  for (const sku of product.skus) {
    statements.push(statement('INSERT INTO skus (sku_id, product_id, name, reference, ean, images_json, seller_id, seller_name, price, list_price, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [sku.skuId, product.productId, sku.name, sku.reference, sku.ean, JSON.stringify(sku.images), sku.seller?.id ?? null, sku.seller?.name ?? null, sku.price, sku.listPrice, sku.stock]));
  }
  await client.batch(statements, 'write');
}

export async function importCatalog(client, catalog, createExtractor) {
  const { extractedAt } = validateCatalog(catalog);
  // Fail before writes if migrations or vector functions are missing.
  await client.execute('SELECT embedding_hash, embedding_model, embedding_version, embedding FROM products LIMIT 0');
  await client.execute('SELECT vector_extract(vector32(\'[0,1]\'))');
  await client.execute('SELECT category_id, name, path FROM categories LIMIT 0');
  await client.execute('SELECT product_id, category_id FROM product_categories LIMIT 0');
  await client.execute('SELECT sku_id, product_id FROM skus LIMIT 0');
  await client.execute('SELECT last_successful_import_at, extracted_at FROM catalog_metadata LIMIT 0');
  const existing = await client.execute('SELECT product_id, embedding_hash, embedding_model, embedding_version, embedding IS NOT NULL AS has_embedding FROM products');
  const known = new Map(existing.rows.map((row) => [row.product_id, row]));
  let extractor, generated = 0, reused = 0;
  for (let index = 0; index < catalog.length; index++) {
    const product = catalog[index];
    const passage = passageFor(product);
    const hash = embeddingHash(passage);
    const previous = known.get(product.productId);
    const reuse = previous && previous.has_embedding && previous.embedding_hash === hash && previous.embedding_model === MODEL_ID && previous.embedding_version === EMBEDDING_VERSION;
    let vector = null;
    let stage = 'generación del embedding';
    try {
      if (!reuse) {
        extractor ??= await createExtractor();
        const result = await extractor(passage, { pooling: 'mean', normalize: true });
        vector = validateVector(result.data);
        generated++;
      } else reused++;
      stage = 'escritura en Turso';
      await saveProduct(client, product, hash, vector, new Date().toISOString());
    } catch (error) {
      throw new Error(`Producto ${index + 1}/${catalog.length} (ID ${product.productId}), ${stage}`, { cause: error });
    }
    if ((index + 1) % 10 === 0 || index + 1 === catalog.length) console.log(`Procesados ${index + 1}/${catalog.length}; embeddings nuevos: ${generated}, reutilizados: ${reused}`);
  }
  await client.execute(statement('INSERT INTO catalog_metadata (id, last_successful_import_at, extracted_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET last_successful_import_at=excluded.last_successful_import_at, extracted_at=excluded.extracted_at', [new Date().toISOString(), extractedAt]));
  return { generated, reused };
}

async function run() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('Faltan TURSO_DATABASE_URL o TURSO_AUTH_TOKEN en .env');
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  validateCatalog(catalog);
  const client = createClient({ url, authToken });
  try {
    await importCatalog(client, catalog, () => pipeline('feature-extraction', MODEL_ID, { revision: MODEL_REVISION, dtype: 'fp32', device: 'cpu' }));
    console.log('Carga completa.');
  } finally { client.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run().catch((error) => {
    const secrets = [process.env.TURSO_DATABASE_URL, process.env.TURSO_AUTH_TOKEN];
    console.error(`Carga incompleta: ${describeError(error, secrets)}`);
    process.exitCode = 1;
  });
}

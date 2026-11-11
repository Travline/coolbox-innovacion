import axios from 'axios';
import { compile } from 'html-to-text';
import { rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TARGET_CATEGORIES = [
  { id: '1', name: 'Audio' },
  { id: '20', name: 'Celulares y Accesorios' },
  { id: '47', name: 'Cómputo' },
  { id: '171', name: 'Gamer' },
  { id: '942', name: 'Smart Home' },
  { id: '101', name: 'TV y Video' },
  { id: '76', name: 'Hogar' }
];

const BASE_URL = 'https://www.coolbox.pe/api/catalog_system/pub/products/search';
const BATCH_SIZE = 50;
const DELAY_MS = 400;
const toText = compile({ wordwrap: false, selectors: [{ selector: 'a', options: { ignoreHref: true } }] });
const sleep = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
const stringOrNull = (value) => typeof value === 'string' && value.trim() ? value : null;
const numberOrNull = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

function categoriesFor(product, target) {
  const categories = new Map();
  const paths = Array.isArray(product.categories) ? product.categories : [];
  const ids = Array.isArray(product.categoriesIds) ? product.categoriesIds : [];
  paths.forEach((path, index) => {
    if (typeof path !== 'string' || typeof ids[index] !== 'string') return;
    const segments = path.split('/').filter(Boolean);
    const id = ids[index].split('/').filter(Boolean).at(-1);
    if (id && segments.length) categories.set(id, { id, name: segments.at(-1), path });
  });
  if (!categories.has(target.id)) categories.set(target.id, { ...target, path: null });
  return [...categories.values()];
}

function parseSku(item) {
  if (!item || !stringOrNull(item.itemId)) throw new Error('SKU sin identificador válido');
  const sellers = Array.isArray(item.sellers) ? item.sellers : [];
  const seller = sellers.find((entry) => entry?.sellerDefault === true) ?? sellers[0];
  const offer = seller?.commertialOffer;
  const reference = Array.isArray(item.referenceId) ? item.referenceId.find((entry) => entry?.Key === 'RefId')?.Value : null;
  return {
    skuId: item.itemId,
    name: stringOrNull(item.name),
    reference: stringOrNull(reference),
    ean: stringOrNull(item.ean),
    images: (Array.isArray(item.images) ? item.images : [])
      .filter((image) => stringOrNull(image?.imageUrl))
      .map((image) => ({ url: image.imageUrl, alt: stringOrNull(image.imageText) ?? stringOrNull(image.imageLabel) })),
    seller: seller ? { id: stringOrNull(seller.sellerId), name: stringOrNull(seller.sellerName) } : null,
    price: numberOrNull(offer?.Price),
    listPrice: numberOrNull(offer?.ListPrice),
    stock: numberOrNull(offer?.AvailableQuantity)
  };
}

export function parseProduct(product, target) {
  if (!product || !stringOrNull(product.productId) || !stringOrNull(product.productName)) {
    throw new Error('Producto sin identificador o nombre válido');
  }
  const specifications = {};
  for (const key of Array.isArray(product.allSpecifications) ? product.allSpecifications : []) {
    if (typeof key === 'string' && Array.isArray(product[key])) {
      specifications[key] = product[key].filter((value) => typeof value === 'string');
    }
  }
  const descriptionHtml = stringOrNull(product.description);
  return {
    productId: product.productId,
    name: product.productName,
    brand: stringOrNull(product.brand),
    reference: stringOrNull(product.productReference),
    slug: stringOrNull(product.linkText),
    sourceUrl: stringOrNull(product.link),
    descriptionHtml,
    descriptionText: descriptionHtml ? stringOrNull(toText(descriptionHtml).trim()) : null,
    specifications,
    categories: categoriesFor(product, target),
    skus: (Array.isArray(product.items) ? product.items : []).map(parseSku)
  };
}

export function mergeProducts(existing, incoming) {
  const categories = new Map(existing.categories.map((category) => [category.id, category]));
  for (const category of incoming.categories) {
    const previous = categories.get(category.id);
    if (!previous || (!previous.path && category.path)) categories.set(category.id, category);
  }
  const skus = new Map(existing.skus.map((sku) => [sku.skuId, sku]));
  for (const sku of incoming.skus) if (!skus.has(sku.skuId)) skus.set(sku.skuId, sku);
  return { ...existing, categories: [...categories.values()], skus: [...skus.values()] };
}

export function validatePage(data, resources, from) {
  if (!Array.isArray(data)) throw new Error('La respuesta no es un arreglo');
  const match = typeof resources === 'string' && resources.match(/^(\d+)-(\d+)\/(\d+)$/);
  if (!match) throw new Error(`Cabecera resources ausente o inválida: ${resources ?? 'ausente'}`);
  const [, start, end, count] = match.map(Number);
  if (count === 0 && start === 0 && from === 0 && data.length === 0 && end >= start && end - start + 1 <= BATCH_SIZE) {
    return { end: -1, total: 0 };
  }
  const effectiveEnd = Math.min(end, count - 1);
  if (start !== from || end < start || start >= count || effectiveEnd - start + 1 !== data.length || end - start + 1 > BATCH_SIZE) {
    throw new Error(`Rango de respuesta incoherente: ${resources}, registros: ${data.length}`);
  }
  return { end: effectiveEnd, total: count };
}

async function requestPage(category, from, to) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await axios.get(BASE_URL, {
        params: { fq: `C:${category.id}`, _from: from, _to: to },
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        timeout: 20000
      });
    } catch (error) {
      const status = error.response?.status;
      if (attempt === 3 || (status && status !== 429 && status < 500)) throw error;
      console.warn(`  Reintento ${attempt}/2 para ${from}-${to}: ${error.message}`);
      await sleep(1000 * attempt);
    }
  }
}

async function fetchCategory(category, products) {
  let from = 0;
  let expectedTotal = null;
  console.log(`Extrayendo ${category.name} (${category.id})`);
  while (true) {
    const to = from + BATCH_SIZE - 1;
    try {
      const response = await requestPage(category, from, to);
      const { end, total } = validatePage(response.data, response.headers.resources, from);
      if (expectedTotal !== null && total !== expectedTotal) throw new Error(`El total cambió de ${expectedTotal} a ${total}`);
      expectedTotal = total;
      for (const raw of response.data) {
        const product = parseProduct(raw, category);
        products.set(product.productId, products.has(product.productId) ? mergeProducts(products.get(product.productId), product) : product);
      }
      console.log(total === 0 ? '  Sin productos' : `  ${from}-${end} de ${total}`);
      if (end + 1 === total) return;
      from = end + 1;
      await sleep(DELAY_MS);
    } catch (error) {
      throw new Error(`Categoría ${category.name} (${category.id}), rango ${from}-${to}: ${error.message}`, { cause: error });
    }
  }
}

async function run() {
  const products = new Map();
  for (const category of TARGET_CATEGORIES) await fetchCategory(category, products);
  const extractedAt = new Date().toISOString();
  const catalog = [...products.values()].map((product) => ({ ...product, extractedAt }));
  const output = resolve('coolbox_productos.json');
  const temporary = `${output}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(catalog, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, output);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
  console.log(`Guardados ${products.size} productos únicos en ${output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run().catch((error) => {
    console.error(`Extracción incompleta: ${error.message}`);
    process.exitCode = 1;
  });
}

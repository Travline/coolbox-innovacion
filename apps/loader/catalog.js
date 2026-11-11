import { createHash } from 'node:crypto';

export const MODEL_ID = 'Xenova/multilingual-e5-small';
export const MODEL_REVISION = '761b726dd34fb83930e26aab4e9ac3899aa1fa78';
export const EMBEDDING_VERSION = `${MODEL_REVISION}:fp32:mean:l2:passage-v1`;

function fail(message) { throw new Error(message); }
function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} debe ser texto no vacío`);
}
function nullableString(value, label) {
  if (value !== null && typeof value !== 'string') fail(`${label} debe ser texto o null`);
}
function array(value, label) { if (!Array.isArray(value)) fail(`${label} debe ser un arreglo`); }
function amount(value, label, integer = false) {
  if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value)))) fail(`${label} inválido`);
}

export function validateCatalog(catalog) {
  array(catalog, 'catálogo');
  if (!catalog.length) fail('El catálogo está vacío');
  const products = new Set(), skus = new Set(), categories = new Map(), dates = new Set();
  for (const product of catalog) {
    if (!product || typeof product !== 'object') fail('Producto inválido');
    requiredString(product.productId, 'productId');
    requiredString(product.name, 'name');
    if (products.has(product.productId)) fail(`Producto duplicado: ${product.productId}`);
    products.add(product.productId);
    for (const field of ['brand', 'reference', 'slug', 'sourceUrl', 'descriptionHtml', 'descriptionText']) nullableString(product[field], field);
    if (!product.specifications || typeof product.specifications !== 'object' || Array.isArray(product.specifications)) fail('specifications inválido');
    for (const values of Object.values(product.specifications)) {
      array(values, 'Valores de especificación');
      if (values.some((value) => typeof value !== 'string')) fail('Especificación no textual');
    }
    array(product.categories, 'categories');
    const productCategories = new Set();
    for (const category of product.categories) {
      if (!category || typeof category !== 'object') fail('Categoría inválida');
      requiredString(category.id, 'category.id'); requiredString(category.name, 'category.name'); nullableString(category.path, 'category.path');
      if (productCategories.has(category.id)) fail(`Categoría repetida en ${product.productId}`);
      productCategories.add(category.id);
      if (categories.has(category.id) && categories.get(category.id) !== category.name) fail(`Nombre de categoría inconsistente: ${category.id}`);
      categories.set(category.id, category.name);
    }
    array(product.skus, 'skus');
    for (const sku of product.skus) {
      if (!sku || typeof sku !== 'object') fail('SKU inválido');
      requiredString(sku.skuId, 'skuId');
      if (skus.has(sku.skuId)) fail(`SKU duplicado: ${sku.skuId}`);
      skus.add(sku.skuId);
      for (const field of ['name', 'reference', 'ean']) nullableString(sku[field], `sku.${field}`);
      array(sku.images, 'images');
      for (const image of sku.images) { if (!image || typeof image !== 'object') fail('Imagen inválida'); requiredString(image.url, 'image.url'); nullableString(image.alt, 'image.alt'); }
      if (sku.seller !== null) { if (!sku.seller || typeof sku.seller !== 'object') fail('Vendedor inválido'); nullableString(sku.seller.id, 'seller.id'); nullableString(sku.seller.name, 'seller.name'); }
      amount(sku.price, 'price'); amount(sku.listPrice, 'listPrice'); amount(sku.stock, 'stock', true);
    }
    requiredString(product.extractedAt, 'extractedAt');
    if (Number.isNaN(Date.parse(product.extractedAt))) fail('Fecha de extracción inválida');
    dates.add(product.extractedAt);
  }
  if (dates.size !== 1) fail('El catálogo contiene fechas de extracción distintas');
  return { extractedAt: [...dates][0] };
}

export function passageFor(product) {
  const categories = [...product.categories].map((c) => c.name).sort();
  const specs = Object.entries(product.specifications).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([name, values]) => `${name}: ${values.join(', ')}`);
  return ['passage:', `Producto: ${product.name}`, product.brand && `Marca: ${product.brand}`,
    categories.length && `Categorías: ${categories.join(', ')}`, ...specs,
    product.descriptionText && `Descripción: ${product.descriptionText}`].filter(Boolean).join('\n');
}

export function embeddingHash(passage) {
  return createHash('sha256').update(`${MODEL_ID}\n${EMBEDDING_VERSION}\n${passage}`).digest('hex');
}

export function validateVector(values) {
  const vector = Array.from(values);
  if (vector.length !== 384 || vector.some((value) => !Number.isFinite(value))) fail('Embedding inválido: se esperan 384 números finitos');
  const norm = Math.hypot(...vector);
  if (Math.abs(norm - 1) > 0.001) fail('Embedding inválido: no está normalizado');
  return vector;
}

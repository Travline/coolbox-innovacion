import { createClient } from '@libsql/client/web';
import type { Client, Row } from '@libsql/client/web';

export type Category = { id: string; name: string; path: string | null };
export type Product = { id: string; name: string; brand: string | null; skuId: string | null; price: number | null; listPrice: number | null; image: string | null };
export type CatalogData = { categories: Category[]; lastImport: string | null; products: Record<string, Product[]> };
export const MAIN_CATEGORIES = [
  { id: '1', name: 'Audio' }, { id: '20', name: 'Celulares y Accesorios' },
  { id: '47', name: 'Cómputo' }, { id: '171', name: 'Gamer' },
  { id: '942', name: 'Smart Home' }, { id: '101', name: 'TV y Video' }, { id: '76', name: 'Hogar' }
] as const;

export function discount(price: number | null, listPrice: number | null): number | null {
  return price !== null && listPrice !== null && listPrice > 0 && price < listPrice ? Math.round((1 - price / listPrice) * 100) : null;
}
export function imageFromJson(value: unknown): string | null {
  try {
    const images = JSON.parse(typeof value === 'string' ? value : '[]');
    return Array.isArray(images) && typeof images[0]?.url === 'string' ? images[0].url : null;
  } catch { return null; }
}
export function childCategories(parent: Category, categories: Category[]): Category[] {
  if (!parent.path) return [];
  return categories.filter((category) => category.path && category.path.startsWith(parent.path!) && category.path !== parent.path && category.path.slice(parent.path!.length).split('/').filter(Boolean).length === 1);
}
function product(row: Row): Product {
  return { id: String(row.product_id), name: String(row.name), brand: typeof row.brand === 'string' ? row.brand : null, skuId: row.sku_id == null ? null : String(row.sku_id), price: typeof row.price === 'number' ? row.price : null, listPrice: typeof row.list_price === 'number' ? row.list_price : null, image: imageFromJson(row.images_json) };
}
export function connect(): Client {
  const url = import.meta.env.VITE_TURSO_DATABASE_URL;
  const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('missing configuration');
  return createClient({ url, authToken });
}
const fields = `p.product_id, p.name, p.brand, s.sku_id, s.price, s.list_price, s.images_json`;
const skuJoin = `LEFT JOIN skus s ON s.sku_id = (SELECT s2.sku_id FROM skus s2 WHERE s2.product_id = p.product_id ORDER BY s2.sku_id LIMIT 1)`;
export async function loadHome(db: Client): Promise<CatalogData> {
  const ids = MAIN_CATEGORIES.map((c) => c.id);
  const [categories, metadata, rows] = await db.batch([
    'SELECT category_id, name, path FROM categories ORDER BY name',
    'SELECT last_successful_import_at FROM catalog_metadata WHERE id = 1',
    { sql: `SELECT * FROM (SELECT pc.category_id, ${fields}, ROW_NUMBER() OVER (PARTITION BY pc.category_id ORDER BY RANDOM()) AS position FROM product_categories pc JOIN products p ON p.product_id = pc.product_id ${skuJoin} WHERE pc.category_id IN (${ids.map(() => '?').join(',')})) WHERE position <= 6 ORDER BY category_id, position`, args: ids }
  ], 'read');
  const products: Record<string, Product[]> = {};
  for (const row of rows.rows) (products[String(row.category_id)] ??= []).push(product(row));
  return { categories: categories.rows.map((r) => ({ id: String(r.category_id), name: String(r.name), path: typeof r.path === 'string' ? r.path : null })), lastImport: typeof metadata.rows[0]?.last_successful_import_at === 'string' ? metadata.rows[0].last_successful_import_at : null, products };
}
export async function loadCategory(db: Client, categoryId: string, page: number): Promise<Product[]> {
  const result = await db.execute({ sql: `SELECT ${fields} FROM product_categories pc JOIN products p ON p.product_id = pc.product_id ${skuJoin} WHERE pc.category_id = ? ORDER BY p.name, p.product_id LIMIT 25 OFFSET ?`, args: [categoryId, page * 24] });
  return result.rows.map(product);
}

export type CatalogFilters = { text: string; categoryId: string; brands: string[]; minPrice: number | null; maxPrice: number | null; sort: 'name' | 'price-asc' | 'price-desc'; page: number };
export function parseCatalogFilters(params: URLSearchParams): CatalogFilters {
  const price = (key: string) => { const raw = params.get(key); if (!raw?.trim()) return null; const n = Number(raw); return Number.isFinite(n) && n >= 0 ? n : null; };
  const sort = params.get('orden');
  const n = Number(params.get('pagina'));
  return { text: (params.get('q') ?? '').trim().slice(0, 200), categoryId: params.get('categoria') ?? '', brands: [...new Set(params.getAll('marca').filter(Boolean))].slice(0, 30), minPrice: price('min'), maxPrice: price('max'), sort: sort === 'price-asc' || sort === 'price-desc' ? sort : 'name', page: Number.isInteger(n) && n > 0 && n <= 100000 ? n - 1 : 0 };
}
export async function loadBrands(db: Client): Promise<string[]> {
  const result = await db.execute("SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL AND TRIM(brand) <> '' ORDER BY brand COLLATE NOCASE");
  return result.rows.map((row) => String(row.brand));
}
export async function searchCatalog(db: Client, filters: CatalogFilters): Promise<{ products: Product[]; total: number }> {
  const conditions: string[] = [], args: (string | number)[] = [];
  if (filters.text) { const pattern = `%${filters.text.replace(/[\\%_]/g, '\\$&')}%`; conditions.push("(p.name LIKE ? ESCAPE '\\' COLLATE NOCASE OR p.brand LIKE ? ESCAPE '\\' COLLATE NOCASE)"); args.push(pattern, pattern); }
  if (filters.categoryId) { conditions.push('EXISTS (SELECT 1 FROM product_categories pc WHERE pc.product_id = p.product_id AND pc.category_id = ?)'); args.push(filters.categoryId); }
  if (filters.brands.length) { conditions.push(`p.brand IN (${filters.brands.map(() => '?').join(',')})`); args.push(...filters.brands); }
  const priceConditions: string[] = [], priceArgs: number[] = [];
  if (filters.minPrice !== null) { priceConditions.push('candidate.price >= ?'); priceArgs.push(filters.minPrice); }
  if (filters.maxPrice !== null) { priceConditions.push('candidate.price <= ?'); priceArgs.push(filters.maxPrice); }
  const priceClause = priceConditions.length ? ` AND ${priceConditions.join(' AND ')}` : '';
  const join = `LEFT JOIN skus s ON s.sku_id = (SELECT candidate.sku_id FROM skus candidate WHERE candidate.product_id = p.product_id${priceClause} ORDER BY candidate.sku_id LIMIT 1)`;
  const allArgs = [...priceArgs, ...args];
  if (priceConditions.length) conditions.push('s.sku_id IS NOT NULL');
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  const order = filters.sort === 'price-asc' ? 's.price IS NULL, s.price ASC, p.name COLLATE NOCASE, p.product_id' : filters.sort === 'price-desc' ? 's.price IS NULL, s.price DESC, p.name COLLATE NOCASE, p.product_id' : 'p.name COLLATE NOCASE, p.product_id';
  const [count, rows] = await db.batch([
    {sql: `SELECT COUNT(*) AS total FROM products p ${join}${where}`, args: allArgs},
    {sql: `SELECT ${fields} FROM products p ${join}${where} ORDER BY ${order} LIMIT 24 OFFSET ?`, args: [...allArgs, filters.page * 24]}
  ], 'read');
  return {total: Number(count.rows[0]?.total ?? 0), products: rows.rows.map(product)};
}

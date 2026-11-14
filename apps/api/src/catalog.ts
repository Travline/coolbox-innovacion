import type { Client, InValue, Row } from '@libsql/client';
import { z } from 'zod';
import { AppError } from './errors.js';
import { EMBEDDING_VERSION, MODEL_ID, queryEmbedding } from './embedding.js';

// Empirical cutoff from the small Spanish evaluation documented in README.md.
// A close vector is only a candidate, not proof that it satisfies the request.
const MAX_SEMANTIC_DISTANCE = 0.145;
const MAX_DISTANCE_FROM_BEST = 0.004;

const schema = z.object({
  text: z.string().trim().min(1).max(500), brand: z.string().trim().min(1).max(100).optional(),
  categoryId: z.string().trim().min(1).max(100).optional(), minPrice: z.number().finite().nonnegative().optional(),
  maxPrice: z.number().finite().nonnegative().optional(), inStock: z.boolean().optional(), limit: z.number().int().min(1).max(20).default(5)
}).strict().refine((v) => v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice);
type Search = z.infer<typeof schema>;
type Database = Pick<Client, 'execute'>;
export type Sku = { id: string; name: string | null; price: number | null; listPrice: number | null; stock: number | null; images: unknown; sellerName: string | null };
export type Product = { id: string; name: string; brand: string | null; description: string | null; specifications: unknown; categories: { id: string; name: string }[]; sku: Sku | null };
const str = (v: unknown): string | null => typeof v === 'string' ? v : null;
const num = (v: unknown): number | null => typeof v === 'number' ? v : null;
function json(v: unknown, fallback: unknown): unknown { try { return typeof v === 'string' ? JSON.parse(v) : fallback; } catch { return fallback; } }
function skuFrom(r: Row): Sku { return { id: String(r.sku_id), name: str(r.name), price: num(r.price), listPrice: num(r.list_price), stock: num(r.stock), images: json(r.images_json, []), sellerName: str(r.seller_name) }; }
function matching(s: Sku, o: Pick<Search, 'minPrice' | 'maxPrice' | 'inStock'>): boolean {
  return (o.minPrice === undefined || (s.price !== null && s.price >= o.minPrice)) && (o.maxPrice === undefined || (s.price !== null && s.price <= o.maxPrice)) && (!o.inStock || (s.stock !== null && s.stock > 0));
}
async function hydrate(db: Database, row: Row, o: Pick<Search, 'minPrice' | 'maxPrice' | 'inStock'>): Promise<Product | null> {
  const id = String(row.product_id);
  const categories = await db.execute({ sql: 'SELECT c.category_id, c.name FROM categories c JOIN product_categories pc ON pc.category_id = c.category_id WHERE pc.product_id = ? ORDER BY c.name', args: [id] });
  const rows = await db.execute({ sql: 'SELECT sku_id, name, price, list_price, stock, images_json, seller_name FROM skus WHERE product_id = ? ORDER BY sku_id', args: [id] });
  const sku = rows.rows.map(skuFrom).find((s) => matching(s, o)) ?? null;
  if (!sku && (o.minPrice !== undefined || o.maxPrice !== undefined || o.inStock)) return null;
  return { id, name: String(row.name), brand: str(row.brand), description: str(row.description_text), specifications: json(row.specifications_json, {}), categories: categories.rows.map((c) => ({ id: String(c.category_id), name: String(c.name) })), sku };
}
const fields = 'p.product_id, p.name, p.brand, p.description_text, p.specifications_json';
export function createCatalog(db: Database, embed: (text: string) => Promise<number[]> = queryEmbedding) {
  return {
    async getProductById(id: unknown): Promise<Product | null> {
      const parsed = z.string().trim().min(1).max(100).safeParse(id);
      if (!parsed.success) throw new AppError('INPUT', 'Identificador de producto inválido.');
      try {
        const r = await db.execute({ sql: `SELECT ${fields} FROM products p WHERE p.product_id = ?`, args: [parsed.data] });
        return r.rows[0] ? await hydrate(db, r.rows[0], {}) : null;
      } catch { throw new AppError('DATABASE', 'No se pudo consultar el catálogo.'); }
    },
    async searchProducts(input: unknown): Promise<Product[]> {
      const parsed = schema.safeParse(input);
      if (!parsed.success) throw new AppError('INPUT', 'Parámetros de búsqueda inválidos.');
      const o = parsed.data, constraints: string[] = [], args: InValue[] = [];
      if (o.brand) { constraints.push('LOWER(p.brand) = LOWER(?)'); args.push(o.brand); }
      if (o.categoryId) { constraints.push('EXISTS (SELECT 1 FROM product_categories pc WHERE pc.product_id = p.product_id AND pc.category_id = ?)'); args.push(o.categoryId); }
      if (o.minPrice !== undefined || o.maxPrice !== undefined || o.inStock) {
        const sku = ['s.product_id = p.product_id'];
        if (o.minPrice !== undefined) { sku.push('s.price >= ?'); args.push(o.minPrice); }
        if (o.maxPrice !== undefined) { sku.push('s.price <= ?'); args.push(o.maxPrice); }
        if (o.inStock) sku.push('s.stock > 0');
        constraints.push(`EXISTS (SELECT 1 FROM skus s WHERE ${sku.join(' AND ')})`);
      }
      const filter = constraints.length ? ` AND ${constraints.join(' AND ')}` : '';
      try {
        const pattern = `%${o.text.replace(/[\\%_]/g, '\\$&')}%`;
        const lexical = await db.execute({ sql: `SELECT ${fields} FROM products p WHERE (p.name LIKE ? ESCAPE '\\' OR p.brand LIKE ? ESCAPE '\\')${filter} ORDER BY CASE WHEN p.name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, p.name LIMIT 40`, args: [pattern, pattern, ...args, `${pattern.slice(1)}`] });
        const vector = await embed(o.text);
        const v = JSON.stringify(vector);
        const semantic = await db.execute({ sql: `SELECT ${fields}, vector_distance_cos(p.embedding, vector32(?)) AS distance FROM vector_top_k('products_embedding_idx', vector32(?), 100) v JOIN products p ON p.rowid = v.id WHERE p.embedding_model = ? AND p.embedding_version = ?${filter} AND vector_distance_cos(p.embedding, vector32(?)) <= ? ORDER BY distance LIMIT 40`, args: [v, v, MODEL_ID, EMBEDDING_VERSION, ...args, v, MAX_SEMANTIC_DISTANCE] });
        const candidates = new Map<string, Row>();
        const bestDistance = Number(semantic.rows[0]?.distance);
        const closeCandidates = Number.isFinite(bestDistance)
          ? semantic.rows.filter((row) => Number(row.distance) <= bestDistance + MAX_DISTANCE_FROM_BEST)
          : [];
        for (const row of [...lexical.rows, ...closeCandidates]) candidates.set(String(row.product_id), row);
        const products: Product[] = [];
        for (const row of candidates.values()) { const product = await hydrate(db, row, o); if (product) products.push(product); if (products.length >= o.limit) break; }
        return products;
      } catch (error) { if (error instanceof AppError) throw error; throw new AppError('DATABASE', 'No se pudo consultar el catálogo.'); }
    }
  };
}

import type { Client, Row } from '@libsql/client/web';

export type DetailImage = { url: string; alt: string | null };
export type DetailSku = {
  id: string; name: string | null; reference: string | null; images: DetailImage[];
  price: number | null; listPrice: number | null; stock: number | null; sellerName: string | null;
};
export type ProductDetailData = {
  id: string; name: string; brand: string | null; reference: string | null;
  descriptionHtml: string | null; descriptionText: string | null;
  specifications: Record<string, string[]>; skus: DetailSku[];
};
export type DetailDatabase = Pick<Client, 'execute'>;

const stringOrNull = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;
const numberOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
function parseJson(value: unknown): unknown {
  try { return typeof value === 'string' ? JSON.parse(value) : null; } catch { return null; }
}
function imageList(value: unknown): DetailImage[] {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object' || !('url' in item) || typeof item.url !== 'string') return [];
    try {
      const url = new URL(item.url);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return [];
      const alt = 'alt' in item ? stringOrNull(item.alt) : null;
      return [{ url: url.href, alt }];
    } catch { return []; }
  });
}
function specList(value: unknown): Record<string, string[]> {
  const parsed = parseJson(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const result: Record<string, string[]> = Object.create(null) as Record<string, string[]>;
  for (const [name, values] of Object.entries(parsed)) {
    if (name.trim() && Array.isArray(values)) {
      const strings = values.filter((v): v is string => typeof v === 'string' && !!v.trim());
      if (strings.length) result[name] = strings;
    }
  }
  return result;
}
function skuFromRow(row: Row): DetailSku {
  return { id: String(row.sku_id), name: stringOrNull(row.name), reference: stringOrNull(row.reference),
    images: imageList(row.images_json), price: numberOrNull(row.price), listPrice: numberOrNull(row.list_price),
    stock: numberOrNull(row.stock), sellerName: stringOrNull(row.seller_name) };
}

/** Reads only the product and its variants; null means the product does not exist. */
export async function loadProductDetail(db: DetailDatabase, productId: string): Promise<ProductDetailData | null> {
  if (typeof productId !== 'string' || !productId.trim() || productId.length > 200) throw new Error('invalid product identifier');
  const product = await db.execute({ sql: 'SELECT product_id, name, brand, reference, description_html, description_text, specifications_json FROM products WHERE product_id = ?', args: [productId] });
  const row = product.rows[0];
  if (!row) return null;
  const variants = await db.execute({ sql: 'SELECT sku_id, name, reference, images_json, seller_name, price, list_price, stock FROM skus WHERE product_id = ? ORDER BY sku_id', args: [productId] });
  return { id: String(row.product_id), name: String(row.name), brand: stringOrNull(row.brand), reference: stringOrNull(row.reference),
    descriptionHtml: stringOrNull(row.description_html), descriptionText: stringOrNull(row.description_text),
    specifications: specList(row.specifications_json), skus: variants.rows.map(skuFromRow) };
}

/** Invalid optional SKU selects the first available variant and reports the fallback. */
export function selectDetailSku(skus: DetailSku[], requested: string | null | undefined): { sku: DetailSku | null; invalid: boolean } {
  const match = requested ? skus.find((sku) => sku.id === requested) : undefined;
  return { sku: match ?? skus[0] ?? null, invalid: !!requested && !match };
}

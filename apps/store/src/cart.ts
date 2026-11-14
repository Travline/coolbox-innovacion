import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { DetailDatabase } from './product-detail';

export type CartItem = { productId: string; skuId: string; name: string; variantName: string | null; imageUrl: string | null; price: number; stock: number; quantity: number };
export type SkuSnapshot = Omit<CartItem, 'quantity' | 'price' | 'stock'> & { price: number | null; stock: number | null };
export type CartStatus = 'verified' | 'unverified' | 'missing' | 'unavailable';
export type CartEntry = CartItem & { verification?: CartStatus; notice?: string };
type CartState = { items: CartEntry[]; open: boolean; storageError: boolean; checking: boolean };
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
const STORAGE_KEY = 'coolbox-cart-v1';
type AddResult = { ok: true } | { ok: false; message: string };

export const cartStore = createStore<CartState>(() => ({ items: [], open: false, storageError: false, checking: false }));
export const useCart = <T,>(select: (state: CartState) => T): T => useStore(cartStore, select);
const pendingSkus = new Set<string>();

function image(value: unknown): string | null {
  try {
    const rows = JSON.parse(typeof value === 'string' ? value : '[]');
    const candidate = Array.isArray(rows) && typeof rows[0]?.url === 'string' ? new URL(rows[0].url) : null;
    return candidate && ['http:', 'https:'].includes(candidate.protocol) ? candidate.href : null;
  } catch { return null; }
}

/** Read one SKU and its parent using fixed, parameterized SQL. */
export async function readCartSku(db: DetailDatabase, productId: string, skuId: string): Promise<SkuSnapshot | null> {
  if (!productId.trim() || !skuId.trim() || productId.length > 200 || skuId.length > 200) throw new Error('invalid identifier');
  const result = await db.execute({ sql: 'SELECT p.product_id, p.name AS product_name, s.sku_id, s.name AS sku_name, s.price, s.stock, s.images_json FROM skus s JOIN products p ON p.product_id = s.product_id WHERE p.product_id = ? AND s.sku_id = ?', args: [productId, skuId] });
  const row = result.rows[0];
  if (!row) return null;
  return { productId: String(row.product_id), skuId: String(row.sku_id), name: String(row.product_name), variantName: typeof row.sku_name === 'string' ? row.sku_name : null, imageUrl: image(row.images_json), price: typeof row.price === 'number' && Number.isFinite(row.price) && row.price >= 0 ? row.price : null, stock: typeof row.stock === 'number' && Number.isSafeInteger(row.stock) && row.stock >= 0 ? row.stock : null };
}

/** Atomically validate and add; stale snapshots and failed reads never change the cart. */
export async function addToCart(db: DetailDatabase, expected: SkuSnapshot, quantity: number): Promise<AddResult> {
  if (!Number.isSafeInteger(quantity) || quantity < 1) return { ok: false, message: 'Indica una cantidad válida.' };
  if (expected.price === null || expected.stock === null || expected.stock <= 0) return { ok: false, message: 'El producto no tiene precio o stock disponible.' };
  if (pendingSkus.has(expected.skuId)) return { ok: false, message: 'Ya se está comprobando este producto.' };
  pendingSkus.add(expected.skuId);
  try {
    const current = await readCartSku(db, expected.productId, expected.skuId);
    if (!current) return { ok: false, message: 'El producto ya no está disponible en el catálogo.' };
    if (current.price !== expected.price || current.stock !== expected.stock) return { ok: false, message: 'El precio o el stock cambió. Actualiza el producto antes de agregarlo.' };
    if (current.price === null || current.stock === null || current.stock <= 0) return { ok: false, message: 'El producto no tiene precio o stock disponible.' };
    const existing = cartStore.getState().items.find((item) => item.skuId === current.skuId);
    if ((existing?.quantity ?? 0) + quantity > current.stock) { const remaining = Math.max(0, current.stock - (existing?.quantity ?? 0)); return { ok: false, message: `La cantidad supera el stock disponible. Puedes agregar hasta ${remaining} más.` }; }
    const item: CartItem = { ...current, price: current.price, stock: current.stock, quantity: (existing?.quantity ?? 0) + quantity };
    cartStore.setState((state) => ({ items: [...state.items.filter((entry) => entry.skuId !== item.skuId), item] }));
    return { ok: true };
  } catch { return { ok: false, message: 'No se pudo verificar el producto. Inténtalo de nuevo.' }; }
  finally { pendingSkus.delete(expected.skuId); }
}

function validStoredItem(item: unknown): item is CartEntry {
  if (!item || typeof item !== 'object') return false;
  const v = item as Record<string, unknown>;
  return typeof v.productId === 'string' && !!v.productId && typeof v.skuId === 'string' && !!v.skuId && typeof v.name === 'string' && (v.variantName === null || typeof v.variantName === 'string') && (v.imageUrl === null || typeof v.imageUrl === 'string') && typeof v.price === 'number' && Number.isFinite(v.price) && v.price >= 0 && typeof v.stock === 'number' && Number.isSafeInteger(v.stock) && v.stock >= 0 && Number.isSafeInteger(v.quantity) && Number(v.quantity) > 0;
}

/** Restore only valid persisted selections. Existing prices and stock are unverified until refreshed. */
export function restoreCart(storage: StorageLike): void {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    if (!saved) return;
    const value: unknown = JSON.parse(saved);
    if (!Array.isArray(value) || !value.every(validStoredItem) || new Set(value.map((x) => x.skuId)).size !== value.length) throw new Error('invalid cart');
    cartStore.setState({ items: value.map((item) => ({ ...item, verification: 'unverified', notice: 'Precio y stock aún no verificados.' })) });
  } catch { cartStore.setState({ storageError: true }); }
}
export function persistCart(storage: StorageLike): () => void {
  return cartStore.subscribe((state, previous) => {
    if (state.items === previous.items) return;
    try { storage.setItem(STORAGE_KEY, JSON.stringify(state.items)); }
    catch { if (!cartStore.getState().storageError) cartStore.setState({ storageError: true }); }
  });
}
export function removeCartItem(skuId: string): void { cartStore.setState((state) => ({ items: state.items.filter((item) => item.skuId !== skuId) })); }
export function changeCartQuantity(skuId: string, quantity: number): boolean {
  const item = cartStore.getState().items.find((entry) => entry.skuId === skuId);
  if (!item || !Number.isSafeInteger(quantity) || quantity < 1) return false;
  if (quantity > item.quantity && (item.verification === 'unverified' || item.verification === 'missing' || item.verification === 'unavailable' || quantity > item.stock)) return false;
  if (quantity > item.stock && quantity >= item.quantity) return false;
  cartStore.setState((state) => ({ items: state.items.map((entry) => entry.skuId === skuId ? { ...entry, quantity, notice: quantity <= entry.stock ? entry.notice?.replace(/La cantidad supera el stock disponible \([0-9]+\)\.?/g, '').trim() : entry.notice } : entry) }));
  return true;
}
export function cartSubtotal(items: CartEntry[]): number | null {
  if (items.some((item) => item.verification === 'unverified' || item.verification === 'missing' || item.verification === 'unavailable')) return null;
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
export async function refreshCart(db: DetailDatabase | null): Promise<void> {
  if (cartStore.getState().checking) return;
  const before = cartStore.getState().items;
  if (!before.length) return;
  cartStore.setState({ checking: true });
  const results = await Promise.all(before.map(async (item) => {
    try { if (!db) throw new Error('missing connection'); return { item, value: await readCartSku(db, item.productId, item.skuId), failed: false }; }
    catch { return { item, value: null, failed: true }; }
  }));
  cartStore.setState((state) => ({ checking: false, items: state.items.map((current) => {
    const result = results.find((entry) => entry.item.skuId === current.skuId && entry.item.productId === current.productId);
    if (!result) return current;
    if (result.failed) return { ...current, verification: 'unverified', notice: 'No se pudieron verificar el precio y el stock. Inténtalo de nuevo.' };
    if (!result.value) return { ...current, verification: 'missing', notice: 'El producto ya no está disponible en el catálogo.' };
    const value = result.value;
    if (value.price === null || value.stock === null || value.stock <= 0) return { ...current, verification: 'unavailable', notice: 'Precio o stock no disponibles. Puedes quitar el producto.' };
    const notices = [value.price !== current.price ? 'El precio cambió.' : '', value.stock !== current.stock ? 'El stock cambió.' : '', current.quantity > value.stock ? `La cantidad supera el stock disponible (${value.stock}).` : ''].filter(Boolean);
    return { ...current, ...value, price: value.price, stock: value.stock, verification: 'verified', notice: notices.join(' ') };
  }) }));
}

if (typeof window !== 'undefined') {
  try { const storage = window.localStorage; restoreCart(storage); persistCart(storage); }
  catch { cartStore.setState({ storageError: true }); }
}

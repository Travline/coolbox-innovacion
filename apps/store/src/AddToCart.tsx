import { useEffect, useRef, useState } from 'react';
import { addToCart, readCartSku } from './cart';
import type { SkuSnapshot } from './cart';
import type { DetailDatabase } from './product-detail';

type Props = { db: DetailDatabase | null; productId: string; skuId: string | null; price: number | null; stock?: number | null; quantity?: number };
export function AddToCart({ db, productId, skuId, price, stock, quantity = 1 }: Props) {
  const [snapshot, setSnapshot] = useState<SkuSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    setSnapshot(null); setMessage(''); setLoading(false);
    if (!db || !skuId || price === null) return () => { active = false; };
    setLoading(true);
    readCartSku(db, productId, skuId).then((item) => {
      if (!active) return;
      if (!item) setMessage('Producto no disponible.');
      else if (item.price !== price || (stock !== undefined && item.stock !== stock)) setMessage('El precio o el stock cambió. Actualiza el producto antes de agregarlo.');
      else setSnapshot(item);
    }).catch(() => { if (active) setMessage('No se pudo verificar el producto.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [db, productId, skuId, price, stock]);
  async function add() {
    if (!db || !snapshot || lock.current) return;
    lock.current = true; setLoading(true); setMessage('');
    const result = await addToCart(db, snapshot, quantity);
    setMessage(result.ok ? 'Producto agregado al carrito.' : result.message);
    setLoading(false); lock.current = false;
  }
  const unavailable = !snapshot || snapshot.price === null || snapshot.stock === null || snapshot.stock <= 0;
  return <div className="add-to-cart"><button type="button" onClick={add} disabled={loading || unavailable || !Number.isSafeInteger(quantity) || quantity < 1}>{loading ? 'Comprobando…' : 'Agregar al carrito'}</button><p role="status" aria-live="polite">{message || (!loading && unavailable ? 'Precio o disponibilidad no verificables.' : '')}</p></div>;
}

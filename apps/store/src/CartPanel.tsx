import { useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { cartStore, cartSubtotal, changeCartQuantity, refreshCart, removeCartItem, useCart } from './cart';
import { connect } from './catalog';
import './cart-panel.css';

export function CartPanel() {
  const open = useCart((state) => state.open);
  const items = useCart((state) => state.items);
  const checking = useCart((state) => state.checking);
  const storageError = useCart((state) => state.storageError);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const db = useMemo(() => { try { return connect(); } catch { return null; } }, []);
  useEffect(() => { void refreshCart(db); }, [db]);
  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    void refreshCart(db);
    return () => { returnFocus.current?.focus(); };
  }, [open, db]);
  if (!open) return storageError ? <p className="cart-storage-warning" role="alert">No se pudo guardar el carrito; tu selección solo estará disponible durante esta visita.</p> : null;
  const subtotal = cartSubtotal(items);
  const close = () => cartStore.setState({ open: false });
  return <div className="cart-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <aside ref={dialogRef} className="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title" onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], select:not([disabled])')];
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
      <div className="cart-heading"><h2 id="cart-title">Mi carrito</h2><button ref={closeRef} type="button" onClick={close} aria-label="Cerrar carrito"><X aria-hidden="true" /></button></div>
      <p className="cart-disclaimer">Precio y stock corresponden a la última carga y pueden haber cambiado.</p>
      {storageError && <p role="alert" className="cart-alert">No se pudo guardar el carrito en este navegador. Tu selección se conserva solo durante esta visita.</p>}
      {checking && <p role="status">Verificando precio y stock…</p>}
      {!items.length ? <p className="cart-empty">Tu carrito está vacío.</p> : <ul className="cart-items">{items.map((item) => <li key={item.skuId}>
        <div className="cart-item-image">{item.imageUrl ? <img src={item.imageUrl} alt="" onError={(event) => { event.currentTarget.hidden = true; }} /> : <span>Sin imagen</span>}</div>
        <div className="cart-item-info"><strong>{item.name}</strong>{item.variantName && <p>{item.variantName}</p>}<p>S/ {item.price.toFixed(2)}{item.verification && item.verification !== 'verified' ? ' (sin verificar)' : ''}</p>{(item.notice || item.quantity > item.stock) && <p className="cart-alert" role="status">{item.notice} {item.quantity > item.stock && !item.notice?.includes('cantidad supera') ? `La cantidad supera el stock disponible (${item.stock}).` : ''}</p>}
          <div className="cart-item-actions"><label htmlFor={`qty-${item.skuId}`}>Cantidad</label><input id={`qty-${item.skuId}`} type="number" min="1" step="1" value={item.quantity} onChange={(event) => { const next = Number(event.target.value); changeCartQuantity(item.skuId, next); }} /><button type="button" onClick={() => removeCartItem(item.skuId)}>Quitar</button></div>
        </div></li>)}</ul>}
      {items.some((item) => item.verification === 'unverified') && <button type="button" disabled={checking} onClick={() => void refreshCart(db)}>Reintentar verificación</button>}
      <div className="cart-total"><strong>Subtotal</strong><strong>{subtotal === null ? 'No disponible hasta verificar precios' : `S/ ${subtotal.toFixed(2)}`}</strong></div>
    </aside>
  </div>;
}

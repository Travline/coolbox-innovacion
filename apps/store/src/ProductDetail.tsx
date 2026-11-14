import { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { AddToCart } from './AddToCart';
import { loadProductDetail, selectDetailSku } from './product-detail';
import type { DetailDatabase, DetailSku, ProductDetailData } from './product-detail';
import './product-detail.css';

type Props = {
  db: DetailDatabase | null;
  productId: string;
  skuId?: string | null;
  onBack: () => void;
  onVariantChange?: (skuId: string) => void;
};

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'missing' } | { status: 'ready'; product: ProductDetailData };

/** Only safe formatting is retained. Links, media, inline styles and event handlers are excluded. */
export function sanitizeDescription(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: []
  });
}
function hasText(html: string): boolean {
  const element = document.createElement('div');
  element.innerHTML = html;
  return !!element.textContent?.trim();
}
function availability(sku: DetailSku | null): string {
  if (sku?.stock === null || sku?.stock === undefined) return 'Disponibilidad no disponible';
  return sku.stock > 0 ? `Disponible: ${sku.stock} ${sku.stock === 1 ? 'unidad' : 'unidades'}` : 'Sin stock';
}

export function ProductDetail({ db, productId, skuId, onBack, onVariantChange }: Props) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(skuId ?? null);
  const [imageIndex, setImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [failedImages, setFailedImages] = useState<string[]>([]);

  useEffect(() => { setSelectedId(skuId ?? null); }, [productId, skuId]);
  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    if (!db) { setState({ status: 'error' }); return () => { active = false; }; }
    loadProductDetail(db, productId).then((product) => {
      if (active) setState(product ? { status: 'ready', product } : { status: 'missing' });
    }).catch(() => { if (active) setState({ status: 'error' }); });
    return () => { active = false; };
  }, [db, productId, attempt]);
  const selected = state.status === 'ready' ? selectDetailSku(state.product.skus, selectedId) : { sku: null, invalid: false };
  const sku = selected.sku;
  useEffect(() => { setImageIndex(0); setFailedImages([]); setQuantity(1); }, [productId, sku?.id]);
  const cleanDescription = useMemo(() => state.status === 'ready' && state.product.descriptionHtml ? sanitizeDescription(state.product.descriptionHtml) : '', [state]);

  if (state.status === 'loading') return <main className="detail-page"><p role="status" className="detail-state">Cargando producto…</p></main>;
  if (state.status === 'missing') return <main className="detail-page"><div className="detail-state"><h1>Producto no encontrado</h1><p>El producto ya no está disponible en el catálogo.</p><button type="button" onClick={onBack}>Volver al catálogo</button></div></main>;
  if (state.status === 'error') return <main className="detail-page"><div className="detail-state" role="alert"><h1>No se pudo consultar el producto</h1><p>Comprueba tu conexión e inténtalo nuevamente.</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>Reintentar</button> <button type="button" onClick={onBack}>Volver al catálogo</button></div></main>;

  const product = state.product;
  const image = sku?.images[imageIndex];
  const specs = Object.entries(product.specifications);
  const formattedPrice = sku?.price == null ? 'Precio no disponible' : `S/ ${sku.price.toFixed(2)}`;
  return <main className="detail-page">
    <nav className="detail-breadcrumb" aria-label="Ruta de navegación"><button type="button" onClick={onBack}>Inicio</button><span aria-hidden="true"> / </span><span>Detalle del producto</span></nav>
    <p className="detail-notice">Precio y stock corresponden a la última carga y pueden haber cambiado.</p>
    <article className="detail-card">
      <div className="detail-overview">
        <section className="detail-gallery" aria-label="Imágenes del producto">
          <div className="detail-main-image">{image && !failedImages.includes(image.url)
            ? <img src={image.url} alt={image.alt || product.name} onError={() => setFailedImages((prev) => [...prev, image.url])} />
            : <span>Imagen no disponible</span>}</div>
          {!!sku?.images.length && <div className="detail-gallery-controls"><button type="button" disabled={imageIndex === 0} onClick={() => setImageIndex((current) => current - 1)} aria-label="Imagen anterior">‹</button><span aria-live="polite">{imageIndex + 1} de {sku.images.length}</span><button type="button" disabled={imageIndex >= sku.images.length - 1} onClick={() => setImageIndex((current) => current + 1)} aria-label="Imagen siguiente">›</button></div>}
          {(sku?.images.length ?? 0) > 1 && <div className="detail-thumbnails" aria-label="Seleccionar imagen">{sku!.images.map((item, index) => <button key={`${item.url}-${index}`} type="button" aria-label={`Ver imagen ${index + 1}`} aria-pressed={index === imageIndex} onClick={() => setImageIndex(index)}>{failedImages.includes(item.url) ? <span>Sin imagen</span> : <img src={item.url} alt="" onError={() => setFailedImages((prev) => [...prev, item.url])} />}</button>)}</div>}
        </section>
        <section className="detail-information" aria-labelledby="detail-title"><p className="detail-reference">Referencia: {sku?.reference ?? product.reference ?? 'No disponible'}</p><p className="detail-brand">{product.brand ?? 'Marca no disponible'}</p><h1 id="detail-title">{product.name}</h1><p className="detail-seller">Vendido por: {sku?.sellerName ?? 'No disponible'}</p>
          {product.skus.length > 1 && <label className="detail-variant">Variante <select value={sku?.id ?? ''} onChange={(event) => { const value = event.target.value; setSelectedId(value); onVariantChange?.(value); }}>{product.skus.map((variant) => <option key={variant.id} value={variant.id}>{variant.name || variant.reference || variant.id}</option>)}</select></label>}
          {selected.invalid && <p className="detail-alert" role="status">La variante solicitada no está disponible. Se muestra otra variante si existe.</p>}
          <div className="detail-highlights"><h2>Acerca del artículo</h2>{specs.length ? <ul>{specs.slice(0, 5).map(([name, values]) => <li key={name}><strong>{name}:</strong> {values.join(', ')}</li>)}</ul> : <p>Características no disponibles.</p>}</div>
        </section>
        <aside className="detail-purchase" aria-label="Precio y disponibilidad"><p className="detail-price">{formattedPrice}</p>{sku?.price != null && sku.listPrice != null && sku.listPrice > sku.price && <p className="detail-list-price">Antes: <del>S/ {sku.listPrice.toFixed(2)}</del></p>}<p>{availability(sku)}</p><p>Datos de la última carga; pueden cambiar.</p><label>Cantidad <input type="number" min="1" step="1" max={sku?.stock ?? undefined} value={Number.isNaN(quantity) ? '' : quantity} onChange={(event) => setQuantity(event.target.value === '' ? NaN : Number(event.target.value))} /></label><AddToCart db={db} productId={product.id} skuId={sku?.id ?? null} price={sku?.price ?? null} stock={sku?.stock ?? null} quantity={quantity} /></aside>
      </div>
      <div className="detail-sections">
        <details open><summary>Especificaciones del producto</summary>{specs.length ? <dl className="detail-specs">{specs.map(([name, values]) => <div key={name}><dt>{name}</dt><dd>{values.join(', ')}</dd></div>)}</dl> : <p>No disponibles.</p>}</details>
        <details open><summary>Descripción</summary>{cleanDescription && hasText(cleanDescription) ? <div className="detail-description" dangerouslySetInnerHTML={{ __html: cleanDescription }} /> : <p>{product.descriptionText ?? 'Descripción no disponible.'}</p>}</details>
      </div>
    </article>
  </main>;
}

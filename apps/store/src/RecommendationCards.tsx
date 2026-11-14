import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Recommendation } from './chat';
import type { DetailDatabase } from './product-detail';
import { AddToCart } from './AddToCart';
import './recommendation-cards.css';

function ProductImage({ product }: { product: Recommendation }) {
  const [failed, setFailed] = useState(false);
  if (!product.imageUrl || failed) return <div className="recommendation-image recommendation-image-empty">Imagen no disponible</div>;
  return <div className="recommendation-image"><img src={product.imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} /></div>;
}

const MAX_PRODUCT_NAME_LENGTH = 45;

function shortProductName(name: string): string {
  const characters = Array.from(name);
  return characters.length > MAX_PRODUCT_NAME_LENGTH
    ? `${characters.slice(0, MAX_PRODUCT_NAME_LENGTH - 3).join('').trimEnd()}...`
    : name;
}

/** Render one verified product at a time. Appending results preserves the selected position. */
export function RecommendationCards({ recommendations, db = null }: { recommendations: Recommendation[]; db?: DetailDatabase | null }) {
  const [index, setIndex] = useState(0);
  if (!recommendations.length) return null;
  const selectedIndex = Math.min(index, recommendations.length - 1);
  const product = recommendations[selectedIndex];
  const displayedName = shortProductName(product.name);
  const displayedReason = product.reason === `Producto: ${product.name}`
    ? `Producto: ${displayedName}`
    : product.reason;
  const detail = `/producto/${encodeURIComponent(product.productId)}${product.skuId ? `?sku=${encodeURIComponent(product.skuId)}` : ''}`;
  return <section className="recommendations" aria-label="Productos recomendados">
    <article className="recommendation-card" aria-label={`Recomendación ${selectedIndex + 1} de ${recommendations.length}`}>
      <ProductImage key={`${product.productId}:${product.imageUrl ?? ''}`} product={product} />
      <div className="recommendation-content"><h3 title={product.name} aria-label={product.name}>{displayedName}</h3><p className="recommendation-price">{product.price === null ? 'Precio no disponible' : `S/ ${product.price.toFixed(2)}`}</p><p title={displayedReason !== product.reason ? product.reason : undefined}>{displayedReason || 'Motivo no disponible'}</p>{product.assumptions?.length ? <p className="recommendation-assumption">Suposición para la búsqueda: {product.assumptions.join('; ')}. Comprueba la compatibilidad antes de comprar.</p> : null}<Link to={detail}>Ver detalle del producto</Link><AddToCart db={db} productId={product.productId} skuId={product.skuId} price={product.price} /></div>
    </article>
    <div className="recommendation-controls" aria-label="Navegación de recomendaciones"><button type="button" onClick={() => setIndex(selectedIndex - 1)} disabled={selectedIndex === 0} aria-label="Producto anterior">Anterior</button><span aria-live="polite">{selectedIndex + 1} de {recommendations.length}</span><button type="button" onClick={() => setIndex(selectedIndex + 1)} disabled={selectedIndex === recommendations.length - 1} aria-label="Producto siguiente">Siguiente</button></div>
  </section>;
}

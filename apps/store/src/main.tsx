import { OperationsPanel } from './OperationsPanel';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ProductDetail } from './ProductDetail';
import { RecommendationCards } from './RecommendationCards';
import { ServiceSources } from './ServiceSources';
import { ContactGuidance } from './ContactGuidance';
import { cartStore, useCart } from './cart';
import { CartPanel } from './CartPanel';
import { AudioLines, Gamepad2, Headphones, Home as HomeIcon, Laptop, Menu, MessageSquareText, ShoppingCart, Smartphone, Tv, X } from 'lucide-react';
import { appendChatFragment, beginChatTurn, finishChatTurn, getChatResponse, initialChatSession, requestChatResponse, retryChatTurn } from './chat';
import type { ChatSession } from './chat';
import { childCategories, connect, discount, loadBrands, loadHome, parseCatalogFilters, searchCatalog, MAIN_CATEGORIES } from './catalog';
import type { CatalogData, Category, Product } from './catalog';
import type { Client } from '@libsql/client/web';
import './style.css';

// Sustituye estas URL por imágenes propias. Si están vacías se conserva el espacio.
const BANNERS = {
  portada: 'https://coolboxpe.vtexassets.com/assets/vtex.file-manager-graphql/images/54c376aa-776e-4178-9e6b-c9bc1561edc5___9233f17626a9cd67c41e7b8e7cbe93a8.jpg',
  franja: 'https://coolboxpe.vtexassets.com/assets/vtex.file-manager-graphql/images/aca6934b-2438-49a5-bd98-c484d3bffc96___cd52fe581b0d6519d693c6204b2092c7.png',
  audio: 'https://coolboxpe.vtexassets.com/assets/vtex.file-manager-graphql/images/8a565966-1161-4b76-9bb8-b7824ddcd69b___2d6e922e0fea55217dbee4699da10805.png',
  celulares: 'https://coolboxpe.vtexassets.com/assets/vtex.file-manager-graphql/images/2537e10a-bf71-4373-9b30-27ccf8d22125___b3204648ebdc2394e44fe80b74e9ea7e.png',
  computo: 'https://coolboxpe.vtexassets.com/assets/vtex.file-manager-graphql/images/8a565966-1161-4b76-9bb8-b7824ddcd69b___2d6e922e0fea55217dbee4699da10805.png',
  gamer: 'https://coolboxpe.vtexassets.com/assets/vtex.file-manager-graphql/images/8a565966-1161-4b76-9bb8-b7824ddcd69b___2d6e922e0fea55217dbee4699da10805.png',
  smartHome: 'https://coolboxpe.vtexassets.com/assets/vtex.file-manager-graphql/images/5270091e-34f8-4c56-a123-e28569f0159a___e759040779527939b51eb9b8ca6c03da.png',
  tv: 'https://coolboxpe.vtexassets.com/assets/vtex.file-manager-graphql/images/5270091e-34f8-4c56-a123-e28569f0159a___e759040779527939b51eb9b8ca6c03da.png',
  hogar: 'https://coolboxpe.vtexassets.com/assets/vtex.file-manager-graphql/images/5270091e-34f8-4c56-a123-e28569f0159a___e759040779527939b51eb9b8ca6c03da.png'
};
const bannerKeys = ['audio', 'celulares', 'computo', 'gamer', 'smartHome', 'tv', 'hogar'] as const;
const icons = [Headphones, Smartphone, Laptop, Gamepad2, HomeIcon, Tv, AudioLines];
function Banner({ name, src, className = '' }: { name: string; src: string; className?: string }) {
  return <div className={`banner ${className}`}>{src && <img src={src} alt={name} />}</div>;
}
function ProductCard({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  const offer = discount(product.price, product.listPrice);
  return <article className="product-card"><Link className="product-card-link" to={`/producto/${encodeURIComponent(product.id)}${product.skuId ? `?sku=${encodeURIComponent(product.skuId)}` : ''}`} aria-label={`Ver detalle de ${product.name}`}>{offer !== null && <span className="offer">-{offer}%</span>}
    <div className="product-image">{product.image && !failed ? <img src={product.image} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span>Imagen no disponible</span>}</div>
    <p className="product-brand">{product.brand || 'Marca no disponible'}</p><h3>{product.name}</h3>
    <p className="price">{product.price === null ? 'Precio no disponible' : `S/ ${product.price.toFixed(2)}`}</p>
    {offer !== null && <del>S/ {product.listPrice!.toFixed(2)}</del>}
  </Link></article>;
}
function Chat() {
  const [open, setOpen] = useState(false), [text, setText] = useState('');
  const [session, setSession] = useState<ChatSession>(initialChatSession);
  const db = useMemo(() => { try { return connect(); } catch { return null; } }, []);
  const sessionRef = useRef(session);
  const openButtonRef = useRef<HTMLButtonElement>(null), inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  function closeChat() { setOpen(false); openButtonRef.current?.focus(); }
  function updateSession(next: ChatSession) { sessionRef.current = next; setSession(next); }
  async function execute(next: ChatSession) {
    if (next === sessionRef.current || !next.attempt) return;
    updateSession(next);
    const attempt = next.attempt;
    const response = await requestChatResponse(attempt.text, attempt.history, getChatResponse, (fragment, recommendation, source, guidance) => {
      if (sessionRef.current.attempt === attempt) updateSession(appendChatFragment(sessionRef.current, fragment, recommendation, source, guidance));
    });
    updateSession(finishChatTurn(sessionRef.current, response));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = beginChatTurn(sessionRef.current, text);
    if (next === sessionRef.current) return;
    setText('');
    await execute(next);
  }
  return <div className="chat-wrap"><button ref={openButtonRef} className="chat-trigger" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="chat"><MessageSquareText aria-hidden="true" size={21} /> <span>Asistente</span></button>
    {open && <section id="chat" className="chat" aria-labelledby="chat-title"><div className="chat-header"><div><p className="eyebrow">ESTAMOS PARA AYUDARTE</p><h2 id="chat-title">Asistente Coolbox</h2></div><button className="close" onClick={closeChat} aria-label="Cerrar asistente"><X aria-hidden="true" /></button></div>
      <div className="conversation" role="log" aria-label="Conversación" aria-live="polite" aria-relevant="additions text"><div className="bubble assistant"><strong>Asistente</strong><p>¡Hola! Cuéntame qué necesitas y te ayudaré a encontrar opciones.</p></div>{session.messages.map((message, index) => <div className={`bubble ${message.role}`} key={index}><strong>{message.role === 'user' ? 'Tú' : 'Asistente'}</strong>{message.recommendations?.length ? <RecommendationCards recommendations={message.recommendations} db={db} /> : <p>{message.text}</p>}{message.sources?.length ? <ServiceSources sources={message.sources} /> : null}{message.guidance && <ContactGuidance guidance={message.guidance} />}</div>)}</div>{session.partial && <div className="bubble assistant" aria-live="off"><strong>Asistente</strong>{session.partialRecommendations.length ? <RecommendationCards recommendations={session.partialRecommendations} db={db} /> : <p style={{ whiteSpace: 'pre-line' }}>{session.partial}</p>}{session.partialSources.length ? <ServiceSources sources={session.partialSources} /> : null}</div>}
      <div className="status" role="status">{session.state === 'pending' ? 'Procesando tu consulta…' : session.state === 'error' ? 'No se pudo completar la consulta. Inténtalo de nuevo.' : session.state === 'incomplete' ? 'La respuesta quedó incompleta. Inténtalo de nuevo.' : ''}</div>
      {(session.state === 'error' || session.state === 'incomplete') && <><button type="button" className="text-button" onClick={() => void execute(retryChatTurn(sessionRef.current))}>Reintentar consulta</button><ContactGuidance guidance={session.partialGuidance} /></>}
      <form onSubmit={submit} className="composer"><label htmlFor="message">Tu consulta</label><div className="input-row"><input ref={inputRef} id="message" value={text} onChange={event => setText(event.target.value)} placeholder="Escribe lo que necesitas" autoComplete="off" /><button className="primary" disabled={session.state === 'pending' || !text.trim()}>Enviar</button></div></form><p className="note">La conversación se conserva solo durante esta visita.</p></section>}
  </div>;
}
function CatalogResults({ db, data, params, setParams, attempt, onRetry }: { db: Client | null; data: CatalogData; params: URLSearchParams; setParams: (next: URLSearchParams) => void; attempt: number; onRetry: () => void }) {
  const filters = parseCatalogFilters(params);
  const [brands, setBrands] = useState<string[]>([]);
  const [brandError, setBrandError] = useState(false);
  const [result, setResult] = useState<{ products: Product[]; total: number } | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [min, setMin] = useState(params.get('min') ?? ''), [max, setMax] = useState(params.get('max') ?? '');
  const [priceError, setPriceError] = useState('');
  const key = params.toString();
  useEffect(() => { setMin(params.get('min') ?? ''); setMax(params.get('max') ?? ''); }, [key]);
  useEffect(() => { let active = true; if (!db) return; loadBrands(db).then((list) => { if (active) { setBrands(list); setBrandError(false); } }).catch(() => { if (active) setBrandError(true); }); return () => { active = false; }; }, [db, attempt]);
  useEffect(() => { let active = true; setState('loading'); if (!db) { setState('error'); return; } searchCatalog(db, parseCatalogFilters(params)).then((value) => { if (active) { setResult(value); setState('ready'); } }).catch(() => { if (active) setState('error'); }); return () => { active = false; }; }, [db, key, attempt]);
  function change(key: string, values: string[]) { const next = new URLSearchParams(params); next.set('catalogo', '1'); next.delete(key); values.filter(Boolean).forEach((value) => next.append(key, value)); next.delete('pagina'); setParams(next); }
  function priceSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const low = min.trim() ? Number(min) : null, high = max.trim() ? Number(max) : null; if ((low !== null && (!Number.isFinite(low) || low < 0)) || (high !== null && (!Number.isFinite(high) || high < 0)) || (low !== null && high !== null && low > high)) { setPriceError('Ingresa un rango de precio válido.'); return; } setPriceError(''); const next = new URLSearchParams(params); next.delete('min'); next.delete('max'); if (low !== null) next.set('min', String(low)); if (high !== null) next.set('max', String(high)); next.delete('pagina'); setParams(next); }
  const chosen = data.categories.find((category) => category.id === filters.categoryId);
  const view = params.get('vista') === 'lista' ? 'lista' : 'cuadricula';
  const title = filters.text ? `Resultados para «${filters.text}»` : chosen?.name ?? 'Catálogo';
  return <><div className="breadcrumb"><Link to="/">Inicio</Link> / {title}</div><Banner name="catalogo" src="https://coolboxpe.vtexassets.com/arquivos/plp_banner_default_desk.png" className="catalog-list-banner" /><div className="section-heading"><div><span className="eyebrow">EXPLORA EL CATÁLOGO</span><h1>{title}</h1></div><button className="text-button" onClick={() => setParams(new URLSearchParams('catalogo=1'))}>Quitar filtros</button></div>
    {chosen && childCategories(chosen, data.categories).length > 0 && <><div className="subcategories category-subcategories-desktop">{childCategories(chosen, data.categories).map(c => <button key={c.id} onClick={() => change('categoria', [c.id])}>{c.name} <span>›</span></button>)}</div><details className="category-subcategories-mobile"><summary>Ver subcategorías ({childCategories(chosen, data.categories).length})</summary><div className="subcategories">{childCategories(chosen, data.categories).map(c => <button key={c.id} onClick={() => change('categoria', [c.id])}>{c.name} <span>›</span></button>)}</div></details></>}
    <div className="catalog-layout"><aside aria-label="Filtros del catálogo" className="catalog-filters"><details><summary>Filtros</summary><label htmlFor="filter-category">Categoría</label><select id="filter-category" value={filters.categoryId} onChange={(e) => change('categoria', [e.target.value])}><option value="">Todas</option>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><fieldset><legend>Marcas</legend><div className="brand-options">{brandError && <p role="alert">No se pudieron cargar las marcas. <button type="button" onClick={onRetry}>Reintentar</button></p>}{brands.map((brand) => <label key={brand}><input type="checkbox" checked={filters.brands.includes(brand)} onChange={(e) => change('marca', e.target.checked ? [...filters.brands, brand] : filters.brands.filter((item) => item !== brand))} /> {brand}</label>)}</div></fieldset><form onSubmit={priceSubmit}><fieldset><legend>Precio en soles</legend><label htmlFor="min-price">Mínimo</label><input id="min-price" type="number" min="0" step="0.01" value={min} onChange={(e) => setMin(e.target.value)} /><label htmlFor="max-price">Máximo</label><input id="max-price" type="number" min="0" step="0.01" value={max} onChange={(e) => setMax(e.target.value)} />{priceError && <p role="alert">{priceError}</p>}<button type="submit">Aplicar precio</button></fieldset></form></details></aside>
      <section className="catalog-results" aria-label="Resultados"><div className="catalog-toolbar"><p>{state === 'ready' ? `${result?.total ?? 0} productos` : 'Consultando…'}</p><label>Ordenar <select value={filters.sort} onChange={(e) => change('orden', [e.target.value])}><option value="name">Nombre</option><option value="price-asc">Precio: menor a mayor</option><option value="price-desc">Precio: mayor a menor</option></select></label><div aria-label="Vista"><button type="button" aria-pressed={view === 'cuadricula'} onClick={() => change('vista', ['cuadricula'])}>Cuadrícula</button><button type="button" aria-pressed={view === 'lista'} onClick={() => change('vista', ['lista'])}>Lista</button></div></div>
        <div className="active-filters" aria-label="Filtros aplicados">{filters.text && <button onClick={() => change('q', [])}>Búsqueda: {filters.text} ×</button>}{chosen && <button onClick={() => change('categoria', [])}>Categoría: {chosen.name} ×</button>}{filters.brands.map((brand) => <button key={brand} onClick={() => change('marca', filters.brands.filter((b) => b !== brand))}>{brand} ×</button>)}{filters.minPrice !== null && <button onClick={() => change('min', [])}>Desde S/ {filters.minPrice} ×</button>}{filters.maxPrice !== null && <button onClick={() => change('max', [])}>Hasta S/ {filters.maxPrice} ×</button>}</div>
        {state === 'loading' ? <p role="status" className="state">Cargando productos…</p> : state === 'error' ? <div className="state" role="alert"><p>No se pudo consultar el catálogo.</p><button onClick={onRetry}>Reintentar</button></div> : !result?.total ? <div className="state"><p>No hay productos que coincidan con los filtros.</p><button onClick={() => setParams(new URLSearchParams('catalogo=1'))}>Quitar filtros</button></div> : <><div className={`product-grid ${view === 'lista' ? 'product-list' : ''}`}>{result.products.map((product) => <ProductCard key={product.id} product={product} />)}</div><div className="pagination"><button disabled={filters.page === 0} onClick={() => { const next = new URLSearchParams(params); next.set('pagina', String(filters.page)); setParams(next); }}>Anterior</button><span>Página {filters.page + 1} de {Math.max(1, Math.ceil(result.total / 24))}</span><button disabled={(filters.page + 1) * 24 >= result.total} onClick={() => { const next = new URLSearchParams(params); next.set('pagina', String(filters.page + 2)); setParams(next); }}>Siguiente</button></div></>}
      </section></div></>;
}
function StoreHeader({ categories = [] }: { categories?: Category[] }) {
  const count = useCart((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [searchText, setSearchText] = useState(params.get('q') ?? '');
  const menuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => { setSearchText(params.get('q') ?? ''); }, [params]);
  function select(id: string) { if (menuRef.current?.open) { menuRef.current.open = false; menuRef.current.querySelector('summary')?.focus(); } navigate(`/?categoria=${encodeURIComponent(id)}`); window.scrollTo(0, 0); }
  function submitSearch(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const next = new URLSearchParams('catalogo=1'); if (searchText.trim()) next.set('q', searchText.trim()); navigate(`/?${next}`); }
  return <><header className="top"><div className="header-inner"><Link to="/" className="brand" aria-label="Coolbox, inicio"><span className="mark">⬡</span>coolbox</Link><details ref={menuRef} className="category-menu" onKeyDown={(event) => { if (event.key === 'Escape' && menuRef.current?.open) { menuRef.current.open = false; menuRef.current.querySelector('summary')?.focus(); } }}><summary className="categories-button"><Menu aria-hidden="true" size={18} /> Categorías</summary><nav aria-label="Menú de categorías" className="category-menu-panel">{MAIN_CATEGORIES.map((c) => <div key={c.id}><button onClick={() => select(c.id)}>{c.name}</button>{categories.find((category) => category.id === c.id) && <div>{childCategories(categories.find((category) => category.id === c.id)!, categories).map((sub) => <button key={sub.id} onClick={() => select(sub.id)}>{sub.name}</button>)}</div>}</div>)}</nav></details><form className="header-search" onSubmit={submitSearch} role="search"><label className="sr-only" htmlFor="catalog-search">Buscar productos o marcas</label><input id="catalog-search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Busca productos o marcas" /><button type="submit">Buscar</button></form><Link className="header-link" to="/?catalogo=1">Explorar catálogo</Link><button type="button" className="cart-count" aria-label={`Abrir carrito: ${count} productos`} onClick={() => cartStore.setState({ open: true })}><ShoppingCart size={22} aria-hidden="true" /><span aria-hidden="true">{count}</span></button></div></header>
    <div className="service-strip"><div>¡Lo mejor en tecnología!</div></div><nav className="category-bar" aria-label="Categorías principales" id="categorias"><div className="category-links">{MAIN_CATEGORIES.map((c, index) => { const Icon = icons[index]; return <button key={c.id} onClick={() => select(c.id)}><Icon aria-hidden="true" size={17} />{c.name}</button>; })}</div></nav>
  </>;
}
function Store() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = searchParams.get('categoria');
  const [data, setData] = useState<CatalogData | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(false), [attempt, setAttempt] = useState(0);
  const db = useMemo(() => { try { return connect(); } catch { return null; } }, []);
  useEffect(() => { let alive = true; setLoading(true); setError(false); if (!db) { setLoading(false); setError(true); return; } loadHome(db).then(result => { if (alive) setData(result); }).catch(() => { if (alive) setError(true); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, [db, attempt]);
  const randomProducts = useMemo(() => { const all = Object.values(data?.products ?? {}).flat(); return [...new Map(all.map(p => [p.id, p])).values()].sort(() => Math.random() - .5); }, [data]);
  function select(id: string) { setSearchParams({ categoria: id }); window.scrollTo(0, 0); }
  return <><StoreHeader categories={data?.categories} />
    <main className="page" id="catalogo">{loading ? <p role="status" className="state">Cargando catálogo…</p> : error ? <div className="state" role="alert"><p>No se pudo cargar el catálogo.</p><button className="primary" onClick={() => setAttempt(a => a + 1)}>Reintentar</button></div> : data && <>
      <p className="catalog-notice">{data.lastImport && !Number.isNaN(Date.parse(data.lastImport)) ? `Última carga completa: ${new Date(data.lastImport).toLocaleDateString('es-PE')}.` : 'Fecha de última carga completa no disponible.'} Los precios y el stock pueden haber cambiado.</p>
      {(selected || searchParams.has('catalogo') || searchParams.has('q')) ? <CatalogResults db={db} data={data} params={searchParams} setParams={setSearchParams} attempt={attempt} onRetry={() => setAttempt(a => a + 1)} /> : <><Banner name="portada" src={BANNERS.portada} className="hero" /><section className="highlights"><div className="section-heading"><div><span className="eyebrow">DESCUBRE MÁS</span><h1>Encuentra algo para ti</h1></div><p>Selección ilustrativa de productos del catálogo.</p></div><div className="highlight-grid">{['Lo último', 'Ofertas top', 'Más vendidos'].map((label, index) => <article className="highlight" key={label}><h2>{label}</h2>{randomProducts[index] ? <ProductCard product={randomProducts[index]} /> : <p>No hay productos disponibles.</p>}<a href="#secciones">Explorar categorías ›</a></article>)}</div></section><Banner name="franja" src={BANNERS.franja} className="wide-banner" /><div id="secciones">{MAIN_CATEGORIES.map((target, index) => { const category = data.categories.find(c => c.id === target.id); const categoryProducts = data.products[target.id] ?? []; return <section className="category-section" key={target.id}><div className="section-heading"><div><span className="eyebrow">DESCUBRE</span><h2>{category?.name ?? target.name}</h2></div>{category && <button className="text-button" onClick={() => select(category.id)}>Ver todo ›</button>}</div><div className="section-content"><div className="category-top"><Banner name={bannerKeys[index]} src={BANNERS[bannerKeys[index]]} className="category-banner" /><div className="subcategories">{category && childCategories(category, data.categories).slice(0, 6).map(c => <button key={c.id} onClick={() => select(c.id)}>{c.name} <span>›</span></button>)}</div></div>{categoryProducts.length ? <div className="product-row">{categoryProducts.map(p => <ProductCard key={p.id} product={p} />)}</div> : <p className="empty">No hay productos disponibles en esta categoría.</p>}</div></section>; })}</div></>}
    </>}</main><footer>Coolbox · Catálogo de referencia</footer></>;
}
function DetailRoute() {
  const { productId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const db = useMemo(() => { try { return connect(); } catch { return null; } }, []);
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => { let active = true; if (db) db.execute('SELECT category_id, name, path FROM categories ORDER BY name').then((result) => { if (active) setCategories(result.rows.map((row) => ({ id: String(row.category_id), name: String(row.name), path: typeof row.path === 'string' ? row.path : null }))); }).catch(() => { }); return () => { active = false; }; }, [db]);
  return <><StoreHeader categories={categories} /><ProductDetail db={db} productId={productId} skuId={params.get('sku')} onBack={() => navigate('/')} onVariantChange={(sku) => setParams({ sku })} /></>;
}
function StoreOverlays() {
  const { pathname } = useLocation();
  if (/^\/(admin|desarrollador)\/?$/i.test(pathname)) return null;
  return <><Chat /><CartPanel /></>;
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Store />} />
      <Route path="/producto/:productId" element={<DetailRoute />} />
      <Route path="/admin" element={<OperationsPanel key="admin" role="admin" />} />
      <Route path="/desarrollador" element={<OperationsPanel key="dev" role="dev" />} />
    </Routes>
    <StoreOverlays />
  </BrowserRouter>,
);

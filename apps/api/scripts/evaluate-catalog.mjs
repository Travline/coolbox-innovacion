// Evaluación manual de solo lectura. No registra configuración ni errores del proveedor.
import { createReadClient } from '../dist/db.js';
import { createCatalog } from '../dist/catalog.js';

const cases = [
  { label: 'tipo', query: { text: 'laptop', limit: 3 } },
  { label: 'marca', query: { text: 'laptop', brand: 'Acer', limit: 3 } },
  { label: 'presupuesto y stock', query: { text: 'laptop', maxPrice: 3000, inStock: true, limit: 3 } },
  { label: 'marca, presupuesto y stock', query: { text: 'audífonos', brand: 'Sony', maxPrice: 500, inStock: true, limit: 3 } },
  { label: 'necesidad', query: { text: 'equipo para escuchar música', limit: 5 } },
  { label: 'sin coincidencia', query: { text: 'máquina de teletransportación interestelar', limit: 3 } },
  { label: 'marca inexistente', query: { text: 'laptop', brand: 'Marca inexistente 24319', limit: 3 } }
];
let db;
try {
  db = createReadClient();
  const catalog = createCatalog(db);
  for (const {label, query} of cases) {
    const start = Date.now();
    const products = await catalog.searchProducts(query);
    console.log(JSON.stringify({ caso: label, ms: Date.now() - start, productos: products.map((p) => ({ nombre: p.name, marca: p.brand, precio: p.sku?.price ?? null, stock: p.sku?.stock ?? null })) }));
  }
} catch (error) {
  console.error(`Evaluación interrumpida: ${['INPUT', 'DATABASE', 'EMBEDDING', 'CONFIG'].includes(error?.code) ? error.code : 'ERROR'}`);
  process.exitCode = 1;
} finally {
  db?.close();
}

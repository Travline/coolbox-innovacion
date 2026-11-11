import axios from 'axios';
import fs from 'fs/promises';

// Mapeo de categorías solicitadas (Tomando 'Hogar' [id 76] para Electrohogar)
const TARGET_CATEGORIES = [
  { id: 1, name: 'Audio' },
  { id: 20, name: 'Celulares y Accesorios' },
  { id: 47, name: 'Cómputo' },
  { id: 171, name: 'Gamer' },
  { id: 942, name: 'Smart Home' },
  { id: 101, name: 'TV y Video' },
  { id: 76, name: 'Hogar' }
];

const BASE_URL = 'https://www.coolbox.pe/api/catalog_system/pub/products/search';
const BATCH_SIZE = 50; // Tamaño máximo permitido por bloque en VTEX
const DELAY_MS = 400;  // Pausa entre peticiones para evitar bloqueos

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseProduct(prod, categoryName) {
  const item = prod.items?.[0] || {};
  const seller = item.sellers?.[0] || {};
  const offer = seller.commertialOffer || {};

  return {
    productId: prod.productId,
    skuId: item.itemId || null,
    name: prod.productName,
    brand: prod.brand,
    category: categoryName,
    price: offer.Price ?? null,
    listPrice: offer.ListPrice ?? null,
    stock: offer.AvailableQuantity ?? 0,
    isDigital: prod['Producto digital']?.[0] === 'Sí',
    link: prod.link,
    imageUrl: item.images?.[0]?.imageUrl || null,
    description: prod.description || null,
  };
}

async function fetchCategoryProducts(category) {
  let products = [];
  let from = 0;
  let hasMore = true;

  console.log(`\n Extrayendo categoría: ${category.name} (ID: ${category.id})...`);

  while (hasMore) {
    const to = from + BATCH_SIZE - 1;

    try {
      const response = await axios.get(BASE_URL, {
        params: {
          fq: `C:${category.id}`,
          _from: from,
          _to: to
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      const items = response.data;

      if (!Array.isArray(items) || items.length === 0) {
        hasMore = false;
        break;
      }

      const parsedItems = items.map((prod) => parseProduct(prod, category.name));
      products.push(...parsedItems);

      console.log(`  -> Obtenidos ${products.length} productos (Índice: ${from}-${to})`);

      // Si devuelve menos que el tamaño del lote, llegamos al final de la categoría
      if (items.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        from += BATCH_SIZE;
        await sleep(DELAY_MS);
      }

    } catch (error) {
      console.error(`❌ Error en categoría ${category.name} [rango ${from}-${to}]:`, error.message);
      hasMore = false; // Detiene el bucle en caso de falla consecutiva
    }
  }

  return products;
}

async function run() {
  const allProducts = [];

  for (const category of TARGET_CATEGORIES) {
    const categoryProducts = await fetchCategoryProducts(category);
    allProducts.push(...categoryProducts);
  }

  console.log(`\n Extraídos un total de ${allProducts.length} productos.`);

  // Guardar resultados en JSON local
  const outputFile = 'coolbox_productos.json';
  await fs.writeFile(outputFile, JSON.stringify(allProducts, null, 2), 'utf-8');
  console.log(`💾 Archivo guardado con éxito: ${outputFile}`);
}

run();
// Solo lectura; no registra la configuración ni el contenido de conversaciones.
import { createReadClient } from '../dist/db.js';
import { createServiceSearch } from '../dist/service.js';
const cases = [
  { text: 'garantía de un producto vendido por Coolbox', topics: ['garantia'], seller: 'propio' },
  { text: 'cambios y devoluciones de un producto Marketplace', topics: ['cambios'], seller: 'marketplace' },
  { text: 'canales de atención al cliente', topics: ['canales'], seller: 'unknown' }
];
let client;
try {
  client = createReadClient();
  const search = createServiceSearch(client);
  for (const item of cases) {
    const results = await search(item);
    console.log(JSON.stringify({ consulta: item.text, resultados: results.map(({sourceId,heading,applicability,checkedAt}) => ({sourceId,heading,applicability,checkedAt})) }));
  }
} catch {
  console.error('No se pudo completar la evaluación de solo lectura.');
  process.exitCode = 1;
} finally { client?.close(); }

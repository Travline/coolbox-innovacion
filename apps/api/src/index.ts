import express from 'express';
import type { Client } from '@libsql/client';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createReadClient } from './db.js';
import { createCatalog } from './catalog.js';
import { createChat } from './chat.js';
import { createApp } from './app.js';
import { createServiceSearch } from './service.js';
import { AppError } from './errors.js';

let client: Client | undefined;
let startupError: unknown;
let app: express.Express;
try {
  client = createReadClient();
  const catalog = createCatalog(client);
  app = createApp(createChat(catalog.searchProducts, undefined, createServiceSearch(client)), process.env.STORE_ORIGIN);
} catch (error) {
  startupError = error;
  // A missing or invalid configuration must not expose environment values or a stack.
  app = express();
  app.disable('x-powered-by');
  app.use((_req, res) => res.status(503).json({ error: 'La API no está configurada.' }));
}

// Vercel imports the app without opening a port. Node starts it only as the entrypoint.
export default app;
const direct = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (direct) {
  const port = Number(process.env.PORT ?? 3001);
  if (startupError || !Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(startupError instanceof AppError ? startupError.message : 'No se pudo iniciar la API.');
    client?.close();
    process.exitCode = 1;
  } else {
    const server = app.listen(port, () => console.log(`API escuchando en puerto ${port}`));
    server.on('error', () => {
      console.error('No se pudo iniciar la API.');
      client?.close();
      process.exitCode = 1;
    });
    let stopping = false;
    const shutdown = () => {
      if (stopping) return;
      stopping = true;
      const deadline = setTimeout(() => { server.closeAllConnections(); client?.close(); process.exitCode = 1; }, 10000);
      deadline.unref();
      server.close(() => { clearTimeout(deadline); client?.close(); });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }
}

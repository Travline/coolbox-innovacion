import { createClient, type Client } from '@libsql/client';
import { AppError } from './errors.js';

export function createReadClient(env: NodeJS.ProcessEnv = process.env): Client {
  const url = env.TURSO_DATABASE_URL?.trim();
  const authToken = env.TURSO_AUTH_TOKEN?.trim();
  if (!url || !authToken) throw new AppError('CONFIG', 'Configura la URL y el token de lectura de Turso.');
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'libsql:' && parsed.protocol !== 'https:') throw new Error('invalid protocol');
    return createClient({ url, authToken });
  } catch {
    throw new AppError('CONFIG', 'La configuración de Turso no es válida.');
  }
}

import express from 'express';
import { chatInput } from './chat.js';
import type { Recommendation } from './chat.js';
import { validateServiceSource } from './service.js';
import { contactGuidance } from './contacts.js';
type Chat = (input: unknown, emit?: (item: Recommendation) => void, signal?: AbortSignal) => Promise<unknown>;
const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'];
function isHttpOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return ['http:', 'https:'].includes(url.protocol) && url.origin === origin;
  } catch { return false; }
}
export function createCors(configuredOrigins?: string): express.RequestHandler {
  const allowedOrigins = new Set(configuredOrigins === undefined
    ? defaultOrigins
    : configuredOrigins.split(',').map((origin) => origin.trim()).filter(isHttpOrigin));
  return (req, res, next) => {
    const origin = req.headers.origin;
    const allowed = !!origin && allowedOrigins.has(origin);
    res.vary('Origin');
    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') { res.sendStatus(allowed ? 204 : 403); return; }
    next();
  };
}
export async function streamChat(chat: Chat, input: unknown, res: express.Response): Promise<void> {
  if (!chatInput.safeParse(input).success) { res.status(400).json({ error: 'Consulta inválida.' }); return; }
  const controller = new AbortController();
  res.on('close', () => { if (!res.writableFinished) controller.abort(); });
  res.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  const send = (event: unknown) => { if (!controller.signal.aborted && !res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`); };
  send({ type: 'activity' });
  let emitted = 0;
  try {
    const result = await chat(input, (item) => {
      emitted++;
      send({ type: 'recommendation', text: `${item.name} — ${item.reason}${item.assumptions?.length ? `\nSuposición para la búsqueda: ${item.assumptions.join('; ')}. Comprueba la compatibilidad antes de comprar.` : ''}`, recommendation: item });
    }, controller.signal) as { status: string; text: string; sources?: unknown[] };
    if (controller.signal.aborted) return;
    if (result.status === 'service') {
      if (!Array.isArray(result.sources) || !result.sources.length) throw new Error('Missing sources');
      const sources = result.sources.map(validateServiceSource);
      if (sources.some((source) => !source)) throw new Error('Invalid sources');
      send({ type: 'message', text: result.text });
      for (const source of sources) send({ type: 'service_source', source });
    } else if (result.status !== 'ok') {
      send({ type: result.status === 'no_results' ? 'no_results' : 'message', text: result.text });
      if (result.status === 'no_results') send({ type: 'guidance', guidance: contactGuidance() });
    }
    else if (!emitted) throw new Error('No verified content');
    send({ type: 'done' });
    res.end();
  } catch {
    if (!controller.signal.aborted) { send({ type: 'guidance', guidance: contactGuidance() }); send({ type: 'error', message: 'No se pudo completar la consulta. Inténtalo de nuevo.' }); res.end(); }
  }
}
export function createApp(chat: Chat, configuredOrigins?: string) {
  const app = express();
  app.disable('x-powered-by');
  app.use(createCors(configuredOrigins));
  app.use(express.json({ limit: '32kb' }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.post('/api/chat', (req, res) => { void streamChat(chat, req.body, res); });
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof SyntaxError || (typeof error === 'object' && error !== null && 'status' in error && error.status === 413)) {
      res.status(400).json({ error: 'Consulta inválida.' }); return;
    }
    res.status(500).json({ error: 'No se pudo completar la consulta.' });
  });
  return app;
}

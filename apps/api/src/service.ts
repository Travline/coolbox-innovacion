import type { Client } from '@libsql/client';
import { z } from 'zod';
import { AppError } from './errors.js';
import { EMBEDDING_VERSION, MODEL_ID, queryEmbedding } from './embedding.js';

export type ServiceSource = { sourceId: string; chunkOrder: number; title: string; url: string; checkedAt: string; heading: string; applicability: 'propio' | 'marketplace' | 'ambos' | 'indeterminado'; content: string };
type Database = Pick<Client, 'execute'>;
const searchSchema = z.object({ text: z.string().trim().min(1).max(500), topics: z.array(z.enum(['garantia', 'cambios', 'canales', 'terminos'])).min(1).max(4), seller: z.enum(['propio', 'marketplace', 'unknown']) }).strict();
type ServiceSearchInput = z.infer<typeof searchSchema>;
export type ServiceSearch = (input: ServiceSearchInput) => Promise<ServiceSource[]>;
const sourcesByTopic = { garantia: ['certificado-garantia', 'postventa-marketplace'], cambios: ['cambios-devoluciones', 'postventa-marketplace'], canales: ['canales-atencion'], terminos: ['terminos-condiciones'] } as const;
const chunkSchema = z.object({ sourceId: z.string().min(1).max(100), chunkOrder: z.number().int().nonnegative(), title: z.string().trim().min(1).max(500), url: z.string().url().refine((v) => { try { const url = new URL(v); return url.protocol === 'https:' && url.hostname === 'www.coolbox.pe' && !url.username && !url.password; } catch { return false; } }), checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => { const d = new Date(`${v}T00:00:00Z`); return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v && d.valueOf() <= Date.now(); }), heading: z.string().trim().min(1).max(500), applicability: z.enum(['propio', 'marketplace', 'ambos', 'indeterminado']), content: z.string().trim().min(1).max(10000) }).strict();
export function validateServiceSource(value: unknown): ServiceSource | null {
  const parsed = chunkSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
export function createServiceSearch(db: Database, embed: (text: string) => Promise<number[]> = queryEmbedding): ServiceSearch {
  return async (input) => {
    const parsed = searchSchema.safeParse(input);
    if (!parsed.success) throw new AppError('INPUT', 'Consulta de servicio inválida.');
    const o = parsed.data;
    const ids = [...new Set(o.topics.flatMap((topic) => [...sourcesByTopic[topic]]))];
    try {
      const vector = JSON.stringify(await embed(o.text));
      const result = await db.execute({ sql: `SELECT c.source_id, c.chunk_order, s.title, s.source_url, s.source_checked_at, c.heading, c.applicability, c.content, vector_distance_cos(c.embedding, vector32(?)) AS distance FROM vector_top_k('service_chunks_embedding_idx', vector32(?), 100) v JOIN service_chunks c ON c.rowid = v.id JOIN service_sources s ON s.source_id = c.source_id WHERE c.embedding_model = ? AND c.embedding_version = ? AND c.source_id IN (${ids.map(() => '?').join(',')}) AND c.applicability IN (?, 'ambos') AND vector_distance_cos(c.embedding, vector32(?)) <= ? ORDER BY distance LIMIT 8`, args: [vector, vector, MODEL_ID, `${EMBEDDING_VERSION}:service-v1`, ...ids, o.seller, vector, 0.25] });
      return result.rows.flatMap((row) => {
        const item = validateServiceSource({ sourceId: row.source_id, chunkOrder: Number(row.chunk_order), title: row.title, url: row.source_url, checkedAt: row.source_checked_at, heading: row.heading, applicability: row.applicability, content: row.content });
        return item ? [item] : [];
      });
    } catch (error) { if (error instanceof AppError) throw error; throw new AppError('DATABASE', 'No se pudo consultar la información de servicio.'); }
  };
}

const serviceTerms = /garant[ií]a|devoluci[oó]n|devoluciones|postventa|pol[ií]tica|cambios|reembolso|canales? de atenci[oó]n|servicio al cliente|atenci[oó]n al cliente|whatsapp|correo de atenci[oó]n|horario de atenci[oó]n|t[eé]rminos y condiciones/iu;
const sellerReply = /^(?:(?:es|fue|de|del|lo vendi[oó]|vendido por)\s+)?(?:marketplace|un vendedor|vendedor asociado|coolbox|tienda coolbox|producto propio)[.!\s]*$/iu;
export function serviceRequest(input: { message: string; history: { role: 'user' | 'assistant'; text: string }[] }): { text: string; topics: ServiceSearchInput['topics']; seller: ServiceSearchInput['seller']; sellerUnknownConfirmed?: boolean } | null {
  const current = input.message.trim();
  const lastAssistant = [...input.history].reverse().find((message) => message.role === 'assistant')?.text;
  const declined = /^(?:no s[eé]|no estoy segur[oa]|no tengo esa informaci[oó]n)[.!\s]*$/iu.test(current) && !!lastAssistant?.startsWith('¿El producto lo vendió Coolbox');
  const previous = (sellerReply.test(current) || declined) ? [...input.history].reverse().find((m) => m.role === 'user' && serviceTerms.test(m.text))?.text : undefined;
  const text = previous ? `${previous} ${current}` : current;
  if (!serviceTerms.test(text)) return null;
  const topics: ServiceSearchInput['topics'] = [];
  if (/garant[ií]a|postventa/iu.test(text)) topics.push('garantia');
  if (/cambios|devoluci[oó]n|devoluciones|reembolso/iu.test(text)) topics.push('cambios');
  if (/canales? de atenci[oó]n|servicio al cliente|atenci[oó]n al cliente|whatsapp|correo de atenci[oó]n|horario de atenci[oó]n/iu.test(text)) topics.push('canales');
  if (/t[eé]rminos y condiciones/iu.test(text)) topics.push('terminos');
  if (!topics.length) return { text, topics: ['garantia', 'cambios'], seller: 'unknown' };
  const sellerText = previous ? current : input.message;
  const market = /marketplace|vendedor asociado|un vendedor/iu.test(sellerText);
  const own = /(?:vendido por|compr[eé] (?:en|a)|producto de|producto propio|vendedor)\s+(?:la\s+)?coolbox|producto propio/iu.test(sellerText) || /^(?:(?:es|fue|de|del)\s+)?coolbox[.!\s]*$/iu.test(sellerText);
  return { text: text.slice(0, 500), topics, seller: market === own ? 'unknown' : market ? 'marketplace' : 'propio', ...(declined ? { sellerUnknownConfirmed: true } : {}) };
}
export async function answerService(search: ServiceSearch, request: NonNullable<ReturnType<typeof serviceRequest>>) {
  if (request.seller === 'unknown' && request.topics.some((t) => t === 'garantia' || t === 'cambios')) {
    if (request.sellerUnknownConfirmed) return { status: 'no_results', text: 'No puedo determinar qué política corresponde sin identificar al vendedor. Consulta el comprobante o los canales oficiales.', sources: [] as ServiceSource[] };
    return { status: 'clarification', text: '¿El producto lo vendió Coolbox o un vendedor Marketplace? Las condiciones pueden ser distintas.', sources: [] as ServiceSource[] };
  }
  const retrieved = await search(request);
  const sourceIds = new Set<string>(request.topics.flatMap((topic) => [...sourcesByTopic[topic]]));
  const valid = retrieved.flatMap((item) => { const source = validateServiceSource(item); return source && sourceIds.has(source.sourceId) && (source.applicability === request.seller || source.applicability === 'ambos') ? [source] : []; });
  if (!valid.length) return { status: 'no_results', text: 'No encontré información oficial suficiente para responder. Consulta las fuentes oficiales o reformula tu pregunta.', sources: [] as ServiceSource[] };
  return { status: 'service', text: 'Estas fuentes fueron revisadas en las fechas indicadas; no puedo confirmar que sigan vigentes ni resolver posibles diferencias entre políticas. Consulta la fuente y el vendedor para verificar las condiciones aplicables.', sources: valid.slice(0, 4) };
}

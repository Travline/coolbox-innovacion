export type Recommendation = { productId: string; skuId: string | null; name: string; reason: string; imageUrl: string | null; price: number | null; assumptions?: string[] };
export type ServiceSource = { sourceId: string; chunkOrder: number; title: string; url: string; checkedAt: string; heading: string; applicability: 'propio' | 'marketplace' | 'ambos' | 'indeterminado'; content: string };
export const CONTACT_SOURCE = 'https://www.coolbox.pe/canales-de-atencion';
export type ContactGuidance = { sourceUrl: typeof CONTACT_SOURCE; checkedAt: string | null; whatsapp: string | null; email: string | null };
export const fallbackGuidance: ContactGuidance = { sourceUrl: CONTACT_SOURCE, checkedAt: null, whatsapp: null, email: null };
export type ChatMessage = { role: 'user' | 'assistant'; text: string; recommendations?: Recommendation[]; sources?: ServiceSource[]; guidance?: ContactGuidance };
export type ChatFragment = (text: string, recommendation?: Recommendation, source?: ServiceSource, guidance?: ContactGuidance) => void;
export type ChatProvider = (text: string, history: ChatMessage[], onText?: ChatFragment) => Promise<string>;
export type ChatResult = { ok: true; text: string } | { ok: false };
export type ChatAttempt = { text: string; history: ChatMessage[] };
export type ChatSession = {
  messages: ChatMessage[];
  state: 'idle' | 'pending' | 'error' | 'incomplete';
  attempt: ChatAttempt | null;
  partial: string;
  partialRecommendations: Recommendation[];
  partialSources: ServiceSource[];
  partialGuidance: ContactGuidance | null;
};

export const initialChatSession: ChatSession = { messages: [], state: 'idle', attempt: null, partial: '', partialRecommendations: [], partialSources: [], partialGuidance: null };

// The retry always uses the exact message and history captured before the first request.
export function beginChatTurn(session: ChatSession, text: string): ChatSession {
  const message = text.trim();
  if (!message || session.state === 'pending') return session;
  return {
    messages: [...session.messages, { role: 'user', text: message }],
    state: 'pending',
    partial: '',
    partialRecommendations: [],
    partialSources: [],
    partialGuidance: null,
    attempt: { text: message, history: session.messages.map(({ role, text }) => ({ role, text })) }
  };
}

export function retryChatTurn(session: ChatSession): ChatSession {
  if ((session.state !== 'error' && session.state !== 'incomplete') || !session.attempt) return session;
  return { ...session, state: 'pending', partial: '', partialRecommendations: [], partialSources: [], partialGuidance: null };
}

export function finishChatTurn(session: ChatSession, result: ChatResult): ChatSession {
  if (session.state !== 'pending' || !session.attempt) return session;
  if (!result.ok) return { ...session, state: session.partial ? 'incomplete' : 'error' };
  return { messages: [...session.messages, { role: 'assistant', text: result.text, ...(session.partialRecommendations.length ? { recommendations: session.partialRecommendations } : {}), ...(session.partialSources.length ? { sources: session.partialSources } : {}), ...(session.partialGuidance ? { guidance: session.partialGuidance } : {}) }], state: 'idle', attempt: null, partial: '', partialRecommendations: [], partialSources: [], partialGuidance: null };
}

export function appendChatFragment(session: ChatSession, text: string, recommendation?: Recommendation, source?: ServiceSource, guidance?: ContactGuidance): ChatSession {
  if (session.state !== 'pending' || (!text && !source && !guidance)) return session;
  return { ...session, partial: text ? session.partial + (session.partial ? '\n' : '') + text : session.partial, partialRecommendations: recommendation ? [...session.partialRecommendations, recommendation] : session.partialRecommendations, partialSources: source ? [...session.partialSources, source] : session.partialSources, partialGuidance: guidance ?? session.partialGuidance };
}

type StreamEvent = { type: string; text?: string; recommendation?: unknown; source?: unknown; guidance?: unknown };
function parseGuidance(value: unknown): ContactGuidance {
  if (!value || typeof value !== 'object') return fallbackGuidance;
  const item = value as Record<string, unknown>;
  const validDate = typeof item.checkedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.checkedAt);
  if (item.sourceUrl !== CONTACT_SOURCE || !validDate) return fallbackGuidance;
  const whatsapp = typeof item.whatsapp === 'string' && /^\d{8,15}$/.test(item.whatsapp) ? item.whatsapp : null;
  const email = typeof item.email === 'string' && /^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(item.email) && item.email.length <= 254 ? item.email : null;
  return whatsapp || email ? { sourceUrl: CONTACT_SOURCE, checkedAt: item.checkedAt as string, whatsapp, email } : fallbackGuidance;
}
function parseServiceSource(value: unknown): ServiceSource | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  for (const key of ['sourceId', 'title', 'url', 'checkedAt', 'heading', 'content'] as const) if (typeof source[key] !== 'string' || !source[key].trim()) return null;
  if (typeof source.chunkOrder !== 'number' || !Number.isInteger(source.chunkOrder) || source.chunkOrder < 0 || !['propio', 'marketplace', 'ambos', 'indeterminado'].includes(String(source.applicability))) return null;
  if ((source.content as string).length > 10000 || !/^\d{4}-\d{2}-\d{2}$/.test(source.checkedAt as string)) return null;
  const date = new Date(`${source.checkedAt}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== source.checkedAt || date.valueOf() > Date.now()) return null;
  try { const url = new URL(source.url as string); if (url.protocol !== 'https:' || url.hostname !== 'www.coolbox.pe' || url.username || url.password) return null; } catch { return null; }
  return { sourceId: source.sourceId as string, chunkOrder: source.chunkOrder, title: source.title as string, url: source.url as string, checkedAt: source.checkedAt as string, heading: source.heading as string, applicability: source.applicability as ServiceSource['applicability'], content: source.content as string };
}
function parseRecommendation(value: unknown): Recommendation | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.productId !== 'string' || !item.productId.trim() || typeof item.name !== 'string' || !item.name.trim() || typeof item.reason !== 'string' || !item.reason.trim() || !(item.skuId === null || (typeof item.skuId === 'string' && item.skuId.trim()))) return null;
  if (item.price != null && (typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0)) return null;
  let imageUrl: string | null = null;
  if (item.imageUrl != null) {
    if (typeof item.imageUrl !== 'string') return null;
    try { const url = new URL(item.imageUrl); if (!['http:', 'https:'].includes(url.protocol)) return null; imageUrl = url.href; } catch { return null; }
  }
  if (item.assumptions !== undefined && (!Array.isArray(item.assumptions) || item.assumptions.length > 2 || item.assumptions.some((assumption: unknown) => typeof assumption !== 'string' || !assumption.trim() || assumption.length > 80))) return null;
  return { productId: item.productId, skuId: item.skuId as string | null, name: item.name, reason: item.reason, imageUrl, price: item.price == null ? null : item.price as number, ...(Array.isArray(item.assumptions) && item.assumptions.length ? { assumptions: item.assumptions as string[] } : {}) };
}

function recommendationText(recommendation: Recommendation): string {
  const text = `${recommendation.name} — ${recommendation.reason}`;
  return recommendation.assumptions?.length
    ? `${text}\nSuposición para la búsqueda: ${recommendation.assumptions.join('; ')}. Comprueba la compatibilidad antes de comprar.`
    : text;
}

export function createChatProvider(apiUrl: string, fetcher: typeof fetch = fetch): ChatProvider {
  return async (text, history, onText = () => {}) => {
    const origin = new URL(apiUrl);
    if (!['http:', 'https:'].includes(origin.protocol)) throw new Error('Dirección de API inválida');
    const response = await fetcher(new URL('/api/chat', origin), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: history.slice(-20) })
    });
    if (!response.ok) throw new Error('No se pudo consultar la API');
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object') throw new Error('Respuesta inválida');
      const result = data as Record<string, unknown>;
      if (!['ok', 'no_results', 'service_unavailable', 'clarification'].includes(String(result.status)) || typeof result.text !== 'string' || !result.text.trim() || !Array.isArray(result.recommendations)) throw new Error('Respuesta inválida');
      const recommendations = result.recommendations.map(parseRecommendation);
      if (recommendations.some((item) => !item) || (result.status === 'ok' && !recommendations.length) || (result.status !== 'ok' && recommendations.length)) throw new Error('Respuesta inválida');
      if (!recommendations.length) { onText(result.text); return result.text; }
      const parts = recommendations.map((item) => { const recommendation = item!; const fragment = recommendationText(recommendation); onText(fragment, recommendation); return fragment; });
      return parts.join('\n');
    }
    if (!response.body || !contentType.includes('text/event-stream')) throw new Error('No se pudo consultar la API');
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let buffer = '', complete = false, finalText = '';
    function handle(record: string) {
      const data = record.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (!data) return;
      const event: StreamEvent = JSON.parse(data);
      if (complete) throw new Error('Evento posterior al final');
      if (event.type === 'activity') return;
      if (event.type === 'guidance') { onText('', undefined, undefined, parseGuidance(event.guidance)); return; }
      if (event.type === 'error') throw new Error('Respuesta interrumpida');
      if (event.type === 'done') { complete = true; return; }
      if (event.type === 'service_source') { const source = parseServiceSource(event.source); if (!source || !finalText) throw new Error('Fuente inválida'); onText('', undefined, source); return; }
      if (!['recommendation', 'message', 'no_results'].includes(event.type) || typeof event.text !== 'string' || !event.text.trim()) throw new Error('Evento inválido');
      const recommendation = event.type === 'recommendation' ? parseRecommendation(event.recommendation) : null;
      if (event.type === 'recommendation' && !recommendation) throw new Error('Recomendación inválida');
      const fragment = recommendation ? recommendationText(recommendation) : event.text;
      finalText += (finalText ? '\n' : '') + fragment;
      onText(fragment, recommendation ?? undefined);
    }
    try {
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n');
        if (buffer.length > 65536) throw new Error('Evento demasiado grande');
        let separator: number;
        while ((separator = buffer.indexOf('\n\n')) !== -1) { handle(buffer.slice(0, separator)); buffer = buffer.slice(separator + 2); }
        if (done) break;
      }
      if (buffer.trim() || !complete || !finalText) throw new Error('Respuesta incompleta');
      return finalText;
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  };
}

export async function getChatResponse(text: string, history: ChatMessage[], onText?: ChatFragment): Promise<string> {
  const apiUrl = import.meta.env?.VITE_API_URL;
  if (!apiUrl) throw new Error('Falta configurar la API');
  return createChatProvider(apiUrl)(text, history, onText);
}

export async function requestChatResponse(text: string, history: ChatMessage[], provider: ChatProvider = getChatResponse, onText?: ChatFragment): Promise<ChatResult> {
  try {
    return { ok: true, text: await provider(text, history, onText) };
  } catch {
    return { ok: false };
  }
}

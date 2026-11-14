import { streamText, stepCountIs, tool } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import type { Product } from './catalog.js';
import { AppError } from './errors.js';
import { answerService, serviceRequest } from './service.js';
import type { ServiceSearch } from './service.js';

export const chatInput = z.object({
  message: z.string().trim().min(1).max(500),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().trim().min(1).max(2000) }).strict()).max(20)
}).strict();
type ChatInput = z.infer<typeof chatInput>;
type Search = (input: unknown, assumptions?: string[]) => Promise<Product[]>;
export type Recommendation = { productId: string; skuId: string | null; name: string; reason: string; imageUrl: string | null; price: number | null; assumptions?: string[] };

function safeImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  for (const image of images) {
    if (!image || typeof image !== 'object' || typeof image.url !== 'string') continue;
    try { const url = new URL(image.url); if (url.protocol === 'http:' || url.protocol === 'https:') return url.href; } catch { /* Try the next image. */ }
  }
  return null;
}
type Model = (input: ChatInput, search: Search, propose: (selection: unknown) => boolean, signal?: AbortSignal) => Promise<unknown>;
const searchSchema = z.object({
  text: z.string().trim().min(1).max(500), brand: z.string().trim().min(1).max(100).optional(),
  categoryId: z.string().trim().min(1).max(100).optional(), minPrice: z.number().finite().nonnegative().optional(),
  maxPrice: z.number().finite().nonnegative().optional(), inStock: z.boolean().optional(), limit: z.number().int().min(1).max(10).optional()
}).strict();
// The model must express the shopping need and the queries separately from guesses.
const interpretationSchema = z.object({
  need: z.string().trim().min(1).max(250),
  queries: z.array(z.string().trim().min(1).max(150)).min(1).max(2),
  assumptions: z.array(z.string().trim().min(1).max(80)).max(2),
  filters: searchSchema.omit({ text: true }).optional()
}).strict();

/** Execute bounded interpreted searches and retain only distinct catalog products. */
export async function searchInterpreted(search: Search, input: unknown): Promise<Product[]> {
  const parsed = interpretationSchema.safeParse(input);
  if (!parsed.success) throw new AppError('INPUT', 'Interpretación de búsqueda inválida.');
  const products = new Map<string, Product>();
  const queries = [...new Set(parsed.data.queries.map((query) => query.trim()))];
  for (const text of queries) {
    const matches = await search({ ...parsed.data.filters, text }, parsed.data.assumptions);
    for (const product of matches) if (!products.has(product.id)) products.set(product.id, product);
  }
  return [...products.values()];
}

const selectionSchema = z.object({
  productId: z.string().min(1), evidence: z.object({ field: z.enum(['name', 'brand', 'category']), value: z.string().min(1).max(500) }).strict()
}).strict();
const outputSchema = z.object({ recommendations: z.array(selectionSchema).max(5) }).strict();
const clarificationSchema = z.object({ clarification: z.enum(['product_type', 'use', 'budget']) }).strict();
const questions = {
  product_type: '¿Buscas una laptop, un celular u otro producto?',
  use: '¿Lo necesitas para estudiar, trabajar o para otro uso?',
  budget: '¿Qué presupuesto aproximado tienes? Si no tienes uno, puedes decirlo.'
} as const;
const noPreference = /(?:^|[^\p{L}])(?:no\s+s[eé]|no\s+tengo\s+(?:una?\s+)?(?:preferencia|presupuesto)|me\s+da\s+igual|cualquiera)(?:$|[^\p{L}])/iu;

// Filters must be grounded in visitor text, never in the assistant's questions.
function groundedSearch(args: z.infer<typeof searchSchema>, input: ChatInput): z.infer<typeof searchSchema> {
  const messages = [...input.history.filter((message) => message.role === 'user').map((message) => message.text), input.message];
  const visitorText = messages.join(' ').normalize('NFKC').toLocaleLowerCase('es');
  const latestAmounts = [...messages].reverse().find((message) => /\d/.test(message)) ?? '';
  const amounts = (latestAmounts.match(/\d+(?:[.,]\d+)*/g) ?? []).flatMap((amount) => {
    const plain = Number(amount.replace(/[.,](?=\d{3}(?:\D|$))/g, '').replace(',', '.'));
    return Number.isFinite(plain) ? [plain] : [];
  });
  const filtered = { ...args };
  if (filtered.brand && !visitorText.includes(filtered.brand.normalize('NFKC').toLocaleLowerCase('es'))) delete filtered.brand;
  if (filtered.categoryId && !visitorText.includes(filtered.categoryId.toLocaleLowerCase('es'))) delete filtered.categoryId;
  if (filtered.minPrice !== undefined && !amounts.includes(filtered.minPrice)) delete filtered.minPrice;
  if (filtered.maxPrice !== undefined && !amounts.includes(filtered.maxPrice)) delete filtered.maxPrice;
  if (filtered.inStock && !/(?:stock|disponible|disponibilidad|hay\s+existencias)/iu.test(visitorText)) delete filtered.inStock;
  const lastAssistant = [...input.history].reverse().find((message) => message.role === 'assistant');
  if (noPreference.test(input.message) && lastAssistant?.text === questions.budget) {
    delete filtered.minPrice;
    delete filtered.maxPrice;
  }
  return filtered;
}

// When the current message names a connector, reject candidates without that
// connector in retrieved fields. This does not establish full compatibility.
function explicitConnectors(message: string): string[] {
  return [...message.matchAll(/\b(?:hdmi|displayport|vga|dvi)\b/giu)]
    .filter((match) => !/\bno(?:\s+es)?\s*$/iu.test(message.slice(Math.max(0, match.index - 12), match.index)))
    .map((match) => match[0].toLocaleLowerCase('es'));
}

// Los valores visibles se construyen exclusivamente a partir de productos recuperados.
export function createChat(search: Search, model: Model = googleModel, serviceSearch?: ServiceSearch) {
  return async (input: unknown, emit: (item: Recommendation) => void = () => {}, signal?: AbortSignal) => {
    const parsed = chatInput.safeParse(input);
    if (!parsed.success) throw new AppError('INPUT', 'Consulta inválida.');
    const service = serviceRequest(parsed.data);
    if (service) {
      if (!serviceSearch) return { status: 'service_unavailable', text: 'Todavía no dispongo de información de servicio verificable.', recommendations: [] };
      return answerService(serviceSearch, service);
    }
    const found = new Map<string, { product: Product; assumptions: string[] }>();
    let calls = 0;
    let searchFailure: unknown;
    const limitedSearch: Search = async (args, assumptions = []) => {
      if (++calls > 3) throw new AppError('INPUT', 'Límite de búsquedas excedido.');
      const valid = searchSchema.safeParse(args);
      if (!valid.success) throw new AppError('INPUT', 'Parámetros de búsqueda inválidos.');
      try {
        const products = await search(groundedSearch(valid.data, parsed.data));
        for (const product of products) if (!found.has(product.id)) found.set(product.id, { product, assumptions });
        return products;
      } catch (error) { searchFailure = error; throw error; }
    };
    const recommendations: Recommendation[] = [];
    const used = new Set<string>();
    const propose = (candidate: unknown): boolean => {
      if (signal?.aborted || recommendations.length >= 5) return false;
      const selected = selectionSchema.safeParse(candidate);
      if (!selected.success) return false;
      const { productId, evidence: { field, value } } = selected.data;
      const match = found.get(productId);
      if (!match || used.has(match.product.id)) return false;
      const { product, assumptions } = match;
      const connectors = explicitConnectors(parsed.data.message);
      const catalogText = `${product.name} ${product.description ?? ''} ${JSON.stringify(product.specifications)}`.toLocaleLowerCase('es');
      if (connectors.length && !connectors.some((connector) => catalogText.includes(connector))) return false;
      const valid = field === 'name' ? product.name === value : field === 'brand' ? product.brand === value : product.categories.some((category) => category.name === value);
      if (!valid) return false;
      const label = field === 'name' ? 'Producto' : field === 'brand' ? 'Marca' : 'Categoría';
      const disclosed = [...assumptions];
      const candidateConnector = /\b(?:cable|adaptador)\b/iu.test(product.name) ? explicitConnectors(product.name)[0] : undefined;
      const visitorText = [...parsed.data.history.filter((entry) => entry.role === 'user').map((entry) => entry.text), parsed.data.message].join(' ');
      if (candidateConnector && !explicitConnectors(visitorText).includes(candidateConnector) && !disclosed.some((item) => item.toLocaleLowerCase('es').includes(candidateConnector))) {
        disclosed.splice(1, 1, `El conector ${candidateConnector.toUpperCase()} no fue confirmado`);
      }
      const item: Recommendation = { productId: product.id, skuId: product.sku?.id ?? null, name: product.name, reason: `${label}: ${value}`, imageUrl: safeImage(product.sku?.images), price: typeof product.sku?.price === 'number' && Number.isFinite(product.sku.price) && product.sku.price >= 0 ? product.sku.price : null, ...(disclosed.length ? { assumptions: disclosed } : {}) };
      used.add(product.id);
      recommendations.push(item);
      emit(item);
      return true;
    };
    let raw: unknown;
    try { raw = await model(parsed.data, limitedSearch, propose, signal); } catch {
      if (searchFailure instanceof AppError) throw searchFailure;
      if (searchFailure) throw new AppError('DATABASE', 'No se pudo consultar el catálogo.');
      throw new AppError('MODEL', 'No se pudo generar una respuesta.');
    }
    if (searchFailure) throw new AppError('DATABASE', 'No se pudo consultar el catálogo.');
    const clarification = clarificationSchema.safeParse(raw);
    if (clarification.success) {
      if (recommendations.length) throw new AppError('MODEL', 'No se pudo verificar la respuesta.');
      const question = questions[clarification.data.clarification];
      const lastAssistant = [...parsed.data.history].reverse().find((message) => message.role === 'assistant');
      const askedAlready = lastAssistant?.text === question;
      const justDeclined = noPreference.test(parsed.data.message) && !!lastAssistant && Object.values(questions).includes(lastAssistant.text as typeof question);
      if (!askedAlready && !justDeclined) return { status: 'clarification', text: question, recommendations: [] };

      // If the visitor declines a preference or the model repeats a question,
      // continue with the explicit request rather than inventing a filter.
      const previous = [...parsed.data.history].reverse().find((message) => message.role === 'user');
      const query = justDeclined ? previous?.text : parsed.data.message;
      if (!query) throw new AppError('MODEL', 'No se pudo interpretar la consulta.');
      await limitedSearch({ text: query });
      // Retrieval identifies candidates, not their relevance to the need. Without
      // a verified model selection, do not promote candidates to recommendations.
      return { status: 'no_results', text: 'No puedo recomendar productos con suficiente fundamento. Prueba con otro tipo de producto o un presupuesto distinto.', recommendations: [] };
    }
    if (!calls) throw new AppError('MODEL', 'No se pudo verificar la respuesta.');
    const output = outputSchema.safeParse(raw);
    if (!output.success) throw new AppError('MODEL', 'No se pudo verificar la respuesta.');
    for (const selection of output.data.recommendations) propose(selection);
    if (!recommendations.length) return { status: 'no_results', text: 'No encontré productos que pueda recomendar con suficiente fundamento. Prueba con otro tipo de producto o un presupuesto distinto.', recommendations };
    const text = recommendations.map((item) => `${item.name} — ${item.reason}${item.assumptions?.length ? `\nSuposición para la búsqueda: ${item.assumptions.join('; ')}. Comprueba la compatibilidad antes de comprar.` : ''}`).join('\n');
    return { status: 'ok', text, recommendations };
  };
}

async function googleModel(input: ChatInput, search: Search, propose: (selection: unknown) => boolean, signal?: AbortSignal): Promise<unknown> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new AppError('CONFIG', 'Falta configurar la clave del modelo.');
  const google = createGoogleGenerativeAI({ apiKey: key });
  const result = streamText({
    model: google(process.env.GOOGLE_MODEL || 'gemini-3.6-flash'),
    abortSignal: signal,
    system: 'Eres un asistente de compras en español. Interpreta el mensaje junto al historial, respetando correcciones y cambios de tema. Usa solo preferencias expresadas por el visitante y no atribuyas las alternativas de tus preguntas al visitante. Si la necesidad es demasiado amplia, pide una sola aclaración devolviendo solamente JSON {"clarification":"product_type|use|budget"}, eligiendo exactamente uno de esos valores; no busques todavía. Si el visitante no sabe, no tiene preferencia o la necesidad ya es suficientemente clara, continúa con lo disponible y busca sin inventar filtros; no repitas preguntas ya hechas. Para recomendar, llama primero a searchProducts con una interpretación estructurada: need resume lo que el visitante necesita; queries contiene una o dos búsquedas cortas de productos del catálogo tecnológico, no el relato completo; assumptions enumera cualquier tipo o compatibilidad deducidos sin confirmación. Ejemplo: si un cable entre computadora y monitor falla, busca cable de video para monitor y cable HDMI, e indica que HDMI es un supuesto por confirmar. Si el usuario confirma otro conector, respétalo. No conviertas supuestos en filtros obligatorios ni en hechos, y usa en filters solo preferencias expresadas por el visitante. Si una solución es una hipótesis razonable y la búsqueda devuelve productos pertinentes, recomiéndalos como opciones condicionadas incluso si el conector aún no está confirmado: la interfaz mostrará los supuestos y pedirá comprobar la compatibilidad. No descartes todos los cables HDMI solo por falta de confirmación; nunca afirmes que serán compatibles o resolverán el fallo. Después llama a la herramienta recommendProduct una vez por cada selección pertinente, usando atributos exactos. Después devuelve solamente JSON sin Markdown con la forma {"recommendations":[{"productId":"...","evidence":{"field":"name|brand|category","value":"valor exacto del catálogo"}}]}. Nunca inventes productos ni atributos. Incluye únicamente productos pertinentes y valores exactos de los resultados. Si no hay productos adecuados devuelve un arreglo vacío. No contestes políticas de servicio.',
    messages: [...input.history.map((m) => ({ role: m.role, content: m.text })), { role: 'user' as const, content: input.message }],
    tools: { searchProducts: tool({ description: 'Interpreta la necesidad y busca productos con una o dos consultas breves. Separa los supuestos de los hechos expresados y usa solo filtros explícitos del visitante.', inputSchema: interpretationSchema, execute: async (input) => searchInterpreted(search, input) }), recommendProduct: tool({ description: 'Presentar una selección pertinente previamente recuperada con un atributo exacto como evidencia.', inputSchema: selectionSchema, execute: async (selection) => ({ accepted: propose(selection) }) }) },
    stopWhen: stepCountIs(8)
  });
  let generated = '';
  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') generated += part.text;
    if (part.type === 'error') throw new Error('model stream error');
  }
  const text = generated.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(text);
}

import { pipeline, env } from '@huggingface/transformers';
import { AppError } from './errors.js';

export const MODEL_ID = 'Xenova/multilingual-e5-small';
export const MODEL_REVISION = '761b726dd34fb83930e26aab4e9ac3899aa1fa78';
export const EMBEDDING_VERSION = `${MODEL_REVISION}:fp32:mean:l2:passage-v1`;
type Extractor = (text: string, options: { pooling: 'mean'; normalize: boolean }) => Promise<{ data: ArrayLike<number> }>;
const loadExtractor = pipeline as unknown as (task: 'feature-extraction', model: string, options: { revision: string; dtype: 'fp32'; device: 'cpu' }) => Promise<Extractor>;
let extractor: Promise<Extractor> | undefined;
// Serverless functions have a read-only application directory; /tmp is ephemeral.
env.cacheDir = process.env.MODEL_CACHE_DIR || (process.env.VERCEL ? '/tmp/coolbox-model-cache' : '.cache');

export async function queryEmbedding(text: string): Promise<number[]> {
  try {
    extractor ??= loadExtractor('feature-extraction', MODEL_ID, { revision: MODEL_REVISION, dtype: 'fp32', device: 'cpu' });
    const model = await extractor;
    const output = await model(`query: ${text.trim()}`, { pooling: 'mean', normalize: true });
    const vector = Array.from(output.data, Number);
    if (vector.length !== 384 || vector.some((value) => !Number.isFinite(value)) || Math.abs(Math.hypot(...vector) - 1) > 0.001) throw new Error('invalid vector');
    return vector;
  } catch {
    extractor = undefined;
    throw new AppError('EMBEDDING', 'No se pudo generar el vector de consulta.');
  }
}

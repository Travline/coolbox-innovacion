export type Role = 'admin' | 'dev';
export type Model = 'baseline' | 'linear' | 'tree' | 'forest';

export const modelNames: Record<Model, string> = {
  baseline: 'Promedio móvil', linear: 'Regresión lineal', tree: 'Árbol de decisión', forest: 'Bosque aleatorio',
};

type Report = {
  history_start: string;
  history_end: string;
  test_start: string;
  test_end: string;
  forecast_start: string;
  horizon_days: number;
  catalog_snapshot_at: string | null;
  stock_checked_at: string | null;
  stock_matches: number;
  stock_errors: number;
  inferred_skus: number;
  sku_count: number;
  models: Record<Model, { mae: number; r2: number | null }>;
};

export type Active = { run_id: string; model: Model; report: Report };
export type Run = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'interrupted';
  stage: string;
  created_at: string;
  error: string | null;
  report: Report | null;
};

export type DailyUnits = { day: string; units: number };

export type Dashboard = {
  active: Active | null;
  categories: {
    name: string;
    forecast_units: number;
    estimated_revenue: number | null;
    unpriced_skus: number;
    history?: DailyUnits[];
    projection?: DailyUnits[];
  }[];
  skus: {
    sku_id: string;
    name: string;
    category: string;
    stock: number | null;
    stock_origin: 'coolbox' | 'catalog_snapshot' | 'unknown';
    forecast_units: number;
    coverage_days: number | null;
    coverage_exceeds_horizon: boolean;
    stockout_risk: boolean | null;
    suggested_reorder: number | null;
    estimated_revenue: number | null;
  }[];
};

export class OperationsError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function operations<T>(path: string, body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/ml/${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
    ...(body && { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  if (response.status === 204) return undefined as T;
  const result = await response.json().catch(() => null);
  if (!response.ok || result === null) {
    throw new OperationsError(result?.detail ?? 'No se pudo consultar el servicio de predicción.', response.status);
  }
  return result as T;
}

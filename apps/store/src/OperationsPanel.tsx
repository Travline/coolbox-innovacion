import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { modelNames, operations, OperationsError } from './operations';
import type { Active, Dashboard, Model, Role, Run } from './operations';
import './operations.css';

const units = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 });
const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
const display = (value: number | null) => value === null ? '—' : units.format(value);
const money = (value: number | null) => value === null ? '—' : soles.format(value);
const stamp = (value: string) => new Date(value.replace(' ', 'T') + (value.includes('T') ? '' : 'Z'))
  .toLocaleString('es-PE', { timeZone: 'America/Lima' });

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo completar la operación.';
}

export function OperationsPanel({ role }: { role: Role }) {
  const [session, setSession] = useState<Role | null>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    operations<{ role: Role }>('session', undefined, controller.signal)
      .then((value) => setSession(value.role))
      .catch((reason) => {
        if (controller.signal.aborted) return;
        if (reason instanceof OperationsError && reason.status === 401) setSession(null);
        else setError(errorText(reason));
      });
    return () => controller.abort();
  }, [attempt]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    setBusy(true);
    try {
      const value = await operations<{ role: Role }>('login', {
        email: form.get('email'), password: form.get('password'),
      });
      setSession(value.role);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError('');
    try {
      await operations('logout', {});
      setSession(null);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  function reportFailure(reason: unknown) {
    if (reason instanceof OperationsError && reason.status === 401) {
      setSession(null);
      setError('Tu sesión terminó. Vuelve a iniciar sesión.');
    } else {
      setError(errorText(reason));
    }
  }

  return <main className="ops">
    <header className="ops-header">
      <div><Link to="/">← Coolbox</Link><h1>{role === 'admin' ? 'Demanda e inventario' : 'Entrenamiento de modelos'}</h1></div>
      {session && <button type="button" onClick={logout} disabled={busy}>Cerrar sesión</button>}
    </header>
    {error && <p className="ops-error" role="alert">{error}</p>}
    {session === undefined && (error ? <button type="button" onClick={() => { setError(''); setAttempt(attempt + 1); }}>
      Reintentar
    </button> : <p role="status">Comprobando sesión…</p>)}
    {session === null && <form className="ops-card ops-login" onSubmit={login}>
      <h2>Iniciar sesión</h2>
      <label>Correo<input type="email" name="email" autoComplete="username" required maxLength={254} /></label>
      <label>Contraseña<input type="password" name="password" autoComplete="current-password" required maxLength={256} /></label>
      <button type="submit" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
    </form>}
    {session && session !== role && <p>Esta cuenta no tiene acceso a esta vista.{' '}
      <Link to={session === 'admin' ? '/admin' : '/desarrollador'}>Abrir mi panel</Link>
    </p>}
    {session === role && (role === 'admin'
      ? <InventoryPanel onError={reportFailure} clearError={() => setError('')} />
      : <ModelPanel onError={reportFailure} clearError={() => setError('')} />)}
  </main>;
}

type PanelProps = { onError: (error: unknown) => void; clearError: () => void };

function Provenance({ report }: { report: Active['report'] }) {
  return <p className="ops-note">
    Datos de demostración. {report.inferred_skus
      ? `${report.inferred_skus} SKU con caídas de stock asignadas al 16–24 de noviembre; el resto de las observaciones se simuló.`
      : 'Todas las observaciones de demanda son sintéticas.'}
    {' '}{report.stock_checked_at && `Consulta de stock: ${stamp(report.stock_checked_at)} · ${report.stock_matches} coincidencias de ${report.sku_count} SKU · ${report.stock_errors} consultas fallidas. `}
    {report.catalog_snapshot_at && `Catálogo del ${stamp(report.catalog_snapshot_at)}.`}
  </p>;
}

function InventoryPanel({ onError, clearError }: PanelProps) {
  const [data, setData] = useState<Dashboard>();
  const [lead, setLead] = useState(7);
  const [coverage, setCoverage] = useState(14);
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState({ lead: 7, coverage: 14 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    operations<Dashboard>(`dashboard?lead_days=${query.lead}&coverage_days=${query.coverage}`, undefined, controller.signal)
      .then(setData)
      .catch((reason) => { if (!controller.signal.aborted) onError(reason); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query]);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();
    setData(undefined);
    setQuery({ lead, coverage });
  }

  const active = data?.active;
  const skus = (data?.skus ?? []).filter((sku) => !category || sku.category === category);
  const categories = (data?.categories ?? []).filter((row) => !category || row.name === category);
  const maxCategory = Math.max(1, ...(data?.categories ?? []).map((row) => row.forecast_units));
  const priced = categories.filter((row) => row.estimated_revenue !== null);
  const knownRisk = skus.filter((sku) => sku.stockout_risk !== null);
  const needsReorder = skus.filter((sku) => (sku.suggested_reorder ?? 0) > 0);

  return <>
    <form className="ops-controls" onSubmit={apply}>
      <label>Plazo de entrega (días)<input type="number" min={1} max={15} required value={lead} onChange={(e) => setLead(e.target.valueAsNumber || 0)} /></label>
      <label>Cobertura objetivo (días)<input type="number" min={1} max={15} required value={coverage} onChange={(e) => setCoverage(e.target.valueAsNumber || 0)} /></label>
      <button type="submit" disabled={loading}>Actualizar indicadores</button>
    </form>
    {loading && <p role="status">Consultando pronóstico…</p>}
    {data && !active && <p className="ops-card">El desarrollador aún no ha activado un modelo.</p>}
    {active && <>
      <p><strong>{modelNames[active.model]}</strong> · {active.report.horizon_days} días desde el {active.report.forecast_start} · {active.report.sku_count} SKU de muestra</p>
      <Provenance report={active.report} />
      <label className="ops-filter">Categoría<select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="">Todas</option>
        {data.categories.map((row) => <option key={row.name}>{row.name}</option>)}
      </select></label>
      <div className="ops-grid">
        <div className="ops-card">Unidades previstas<strong>{display(skus.reduce((sum, sku) => sum + sku.forecast_units, 0))}</strong></div>
        <div className="ops-card">Ingresos estimados<strong>{money(priced.length ? priced.reduce((sum, row) => sum + (row.estimated_revenue ?? 0), 0) : null)}</strong>
          <small>{skus.filter((sku) => sku.estimated_revenue === null).length} SKU sin precio</small></div>
        <div className="ops-card">SKU en riesgo<strong>{knownRisk.filter((sku) => sku.stockout_risk).length} de {knownRisk.length}</strong>
          <small>{skus.length - knownRisk.length} sin stock conocido</small></div>
        <div className="ops-card">SKU a reponer<strong>{needsReorder.length}</strong>
          <small>{needsReorder.reduce((sum, sku) => sum + (sku.suggested_reorder ?? 0), 0)} unidades sugeridas</small></div>
      </div>
      <section className="ops-card">
        <h2>Pronóstico por categoría</h2>
        <ul className="ops-bars">{categories.map((row) => <li key={row.name}>
          <span>{row.name}</span><meter min={0} max={maxCategory} value={row.forecast_units} aria-label={`Unidades en ${row.name}`} />
          <span>{display(row.forecast_units)} u. · {money(row.estimated_revenue)}</span>
        </li>)}</ul>
      </section>
      <section className="ops-card">
        <h2>Inventario por SKU</h2>
        <p className="ops-note">Riesgo estimado dentro de {query.lead} días. Reposición sugerida para cubrir el plazo de entrega y {query.coverage} días adicionales.</p>
        <div className="ops-table"><table><thead><tr>
          <th>Producto</th><th>Stock</th><th>Unidades previstas</th><th>Cobertura (días)</th>
          <th>Riesgo de quiebre</th><th>Reposición (u.)</th><th>Ingresos estimados</th>
        </tr></thead><tbody>
          {[...skus].sort((a, b) => Number(b.stockout_risk === true) - Number(a.stockout_risk === true)
            || (b.suggested_reorder ?? 0) - (a.suggested_reorder ?? 0)).map((sku) => <tr key={sku.sku_id}>
            <th scope="row">{sku.name}<small>SKU {sku.sku_id} · {sku.category}</small></th>
            <td>{display(sku.stock)}<small>{sku.stock_origin === 'coolbox' ? 'Consulta Coolbox' : sku.stock_origin === 'catalog_snapshot' ? 'Catálogo guardado' : 'Desconocido'}</small></td>
            <td>{display(sku.forecast_units)}</td>
            <td>{sku.coverage_exceeds_horizon ? `> ${active.report.horizon_days}` : display(sku.coverage_days)}</td>
            <td>{sku.stockout_risk === null ? '—' : sku.stockout_risk ? 'En riesgo' : 'Sin alerta'}</td>
            <td>{display(sku.suggested_reorder)}</td><td>{money(sku.estimated_revenue)}</td>
          </tr>)}
        </tbody></table></div>
      </section>
    </>}
  </>;
}

type RunList = { active: Active | null; runs: Run[] };

function ModelPanel({ onError, clearError }: PanelProps) {
  const [data, setData] = useState<RunList>();
  const [compare, setCompare] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const pending = data?.runs.find((run) => run.status === 'queued' || run.status === 'running');
  const viewed = data?.runs.find((run) => run.id === selected) ?? data?.runs[0];

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const result = await operations<RunList>('runs', undefined, controller.signal);
        if (controller.signal.aborted) return;
        setData(result);
        if (result.runs.some((run) => ['queued', 'running'].includes(run.status))) {
          timer = setTimeout(refresh, 2000);
        }
      } catch (reason) {
        if (!controller.signal.aborted) onError(reason);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [revision]);

  async function dispatch(path: 'runs' | 'active', payload: object) {
    setBusy(true);
    clearError();
    try {
      const result = await operations<{ id?: string }>(path, payload);
      if (result.id) setSelected(result.id);
    } catch (reason) {
      onError(reason);
    } finally {
      setRevision((value) => value + 1);
      setBusy(false);
    }
  }

  return <>
    <div className="ops-controls">
      <label className="ops-check"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Comparar stock con Coolbox</label>
      <button type="button" disabled={busy || loading || Boolean(pending)} onClick={() => void dispatch('runs', { compare_stock: compare })}>Reentrenar modelos</button>
      <button type="button" disabled={busy || loading} onClick={() => { clearError(); setRevision(revision + 1); }}>Actualizar estado</button>
    </div>
    {loading && <p role="status">Consultando entrenamientos…</p>}
    {pending && <p role="status">{pending.stage}…</p>}
    {data && <p>Modelo activo: <strong>{data.active ? modelNames[data.active.model] : 'ninguno'}</strong></p>}
    {data && !data.runs.length && <p>Inicia un entrenamiento para comparar los modelos.</p>}
    {viewed && <section className="ops-card">
      <label>Entrenamiento<select value={viewed.id} onChange={(e) => setSelected(e.target.value)}>
        {data?.runs.map((run) => <option key={run.id} value={run.id}>{stamp(run.created_at)} · {run.stage}</option>)}
      </select></label>
      {viewed.error && <p className="ops-error" role="alert">{viewed.error}</p>}
      {viewed.report && <>
        <Provenance report={viewed.report} />
        <p>Historial del {viewed.report.history_start} al {viewed.report.history_end}.
          Prueba del {viewed.report.test_start} al {viewed.report.test_end}.</p>
        <p className="ops-note">Un MAE menor indica menos error en unidades por día y SKU. R² puede ser negativo. Las métricas corresponden a esta muestra de demostración.</p>
        <div className="ops-table"><table><thead><tr><th>Modelo</th><th>MAE (u.)</th><th>R²</th><th>Activación</th></tr></thead>
          <tbody>{(Object.entries(viewed.report.models) as [Model, { mae: number; r2: number | null }][])
            .sort(([, a], [, b]) => a.mae - b.mae).map(([model, scores]) => {
              const active = data?.active?.run_id === viewed.id && data.active.model === model;
              return <tr key={model}><th scope="row">{modelNames[model]}</th><td>{scores.mae.toFixed(3)}</td>
                <td>{scores.r2?.toFixed(3) ?? '—'}</td><td>{active ? 'Activo' : <button type="button" disabled={busy}
                  onClick={() => void dispatch('active', { run_id: viewed.id, model })}>Activar</button>}</td></tr>;
            })}</tbody>
        </table></div>
      </>}
    </section>}
  </>;
}

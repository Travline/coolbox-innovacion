import type { DailyUnits, Dashboard } from './operations';

const quantity = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric', month: 'short', timeZone: 'UTC',
});
const formatDay = (day: string) => shortDate.format(new Date(day));

function sumByDay(categories: Dashboard['categories'], field: 'history' | 'projection'): DailyUnits[] {
  const totals = new Map<string, number>();
  for (const category of categories) {
    for (const { day, units } of category[field] ?? []) {
      totals.set(day, (totals.get(day) ?? 0) + units);
    }
  }
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([day, units]) => ({ day, units }));
}

export function SalesTrend({ categories, category }: {
  categories: Dashboard['categories'];
  category: string;
}) {
  const history = sumByDay(categories, 'history');
  const projection = sumByDay(categories, 'projection');
  const hasFullHistory = categories.every((row) => row.history?.length);
  const groups = [
    { id: 'history', label: 'Historial de referencia', points: hasFullHistory ? history : [] },
    { id: 'projection', label: 'Proyección del modelo activo', points: projection },
  ].filter(({ points }) => points.length > 0);
  const peak = Math.max(1, ...groups.flatMap(({ points }) => points.map(({ units }) => units)));
  const step = 10 ** Math.floor(Math.log10(peak)) / 2;
  const max = Math.ceil(peak / step) * step;
  const scope = category || 'Todas las categorías de la muestra';

  return <section className="ops-card ops-trend">
    <h2>Ventas y proyección por categoría</h2>
    <p><strong>{scope}</strong> · Unidades por día</p>
    {!projection.length ? <p role="status">La serie diaria todavía no está disponible.</p> : <>
      <ul className="ops-trend-legend">
        {groups.map(({ id, label }) => <li key={id} className={`ops-trend-${id}`}>{label}</li>)}
      </ul>
      <p className="ops-note">
        {hasFullHistory
          ? 'El historial usa datos simulados y, cuando hay caídas de stock comparables, ventas inferidas. La proyección usa las predicciones diarias del modelo activo.'
          : 'El historial de referencia no está disponible para esta selección. Se muestra la proyección del modelo activo.'}
      </p>
      <div className="ops-trend-chart" aria-hidden="true">
        <div className="ops-trend-scale">
          {[max, max / 2, 0].map((value) => <span key={value}>{quantity.format(value)}</span>)}
        </div>
        <div className="ops-trend-plot">
          {groups.map(({ id, label, points }) => <div key={id} className={`ops-trend-group ops-trend-${id}`} style={{ flex: points.length }}>
            <div className="ops-trend-columns">
              {points.map(({ day, units }) => <div className="ops-trend-slot" key={day}
                title={`${formatDay(day)} · ${label}: ${quantity.format(units)} u.`}>
                <div className="ops-trend-bar" style={{ height: `${units / max * 100}%` }} />
              </div>)}
            </div>
            <div className="ops-trend-dates"><span>{formatDay(points[0].day)}</span><span>{formatDay(points[points.length - 1].day)}</span></div>
          </div>)}
        </div>
      </div>
      <details className="ops-trend-data">
        <summary>Ver unidades por fecha</summary>
        <div className="ops-table"><table>
          <thead><tr><th>Fecha</th><th>Serie</th><th>Unidades</th></tr></thead>
          <tbody>{groups.flatMap(({ id, label, points }) => points.map(({ day, units }) =>
            <tr key={`${id}-${day}`}><th scope="row">{day}</th><td>{label}</td><td>{quantity.format(units)}</td></tr>
          ))}</tbody>
        </table></div>
      </details>
    </>}
  </section>;
}

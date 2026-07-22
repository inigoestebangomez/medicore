'use client';

// apps/web/src/components/research/results-viewer.tsx
// Renders research query results: sortable table (anonymized display), a stats
// panel (mean/median/SD/CI95%), and chart visualizations via Recharts.
// BR-RES-004: distributions/stats are already N<5-suppressed server-side; the
// viewer additionally hides any empty chart and renders a warning when a
// field had insufficient sample size (n shown).

import { useMemo, useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { ResultRow, FieldStat, CategoryDist } from '@/hooks/useResearch';

// ─────────────────────────────────────────────
// Numeric helpers — extract numeric series from rows for line/scatter/box
// ─────────────────────────────────────────────

/** Field names that hold at least one numeric value across the result rows. */
function numericFields(rows: ResultRow[]): string[] {
  const fields = new Set<string>();
  for (const row of rows) {
    for (const [k, v] of Object.entries(row.fields)) {
      if (typeof v === 'number' && !Number.isNaN(v)) fields.add(k);
    }
  }
  return [...fields];
}

/** Pull every non-NaN number for a field out of the rows (preserves order). */
function numericValues(rows: ResultRow[], field: string): number[] {
  return rows
    .map((r) => r.fields[field])
    .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
}

/** Linear-interpolated quantile of an already-sorted ascending array. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

const CHART_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export interface ResultsViewerProps {
  rows: ResultRow[];
  displayFields: string[];
  stats: FieldStat[];
  distributions: CategoryDist[];
}

type SortKey = { field: string; dir: 'asc' | 'desc' };

export function ResultsViewer({ rows, displayFields, stats, distributions }: ResultsViewerProps) {
  const [sort, setSort] = useState<SortKey | null>(null);

  // Numeric analysis (spec §10 — line / scatter / box plot switcher).
  const numFields = useMemo(() => numericFields(rows), [rows]);
  const [chartType, setChartType] = useState<'line' | 'scatter' | 'box'>('line');
  const [lineField, setLineField] = useState<string>('');
  const [scatterX, setScatterX] = useState<string>('');
  const [scatterY, setScatterY] = useState<string>('');
  const [boxField, setBoxField] = useState<string>('');

  // Default to the first available numeric field when none chosen.
  const effectiveLineField = lineField || (numFields[0] ?? '');
  const effectiveScatterX = scatterX || (numFields[0] ?? '');
  const effectiveScatterY = scatterY || (numFields[1] ?? numFields[0] ?? '');
  const effectiveBoxField = boxField || (numFields[0] ?? '');

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const { field, dir } = sort;
    return [...rows].sort((a, b) => {
      const av = a.fields[field] ?? (a as unknown as Record<string, unknown>)[field];
      const bv = b.fields[field] ?? (b as unknown as Record<string, unknown>)[field];
      if (av === bv) return 0;
      const cmp = av === null || av === undefined
        ? -1
        : bv === null || bv === undefined
          ? 1
          : av > bv ? 1 : -1;
      return dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sort]);

  const toggleSort = (field: string) => {
    setSort((prev) =>
      prev?.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'asc' },
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats panel */}
      {stats.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-on-surface-variant">Estadística descriptiva</h3>
          <div className="overflow-x-auto rounded-md border border-outline-variant">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-low text-on-surface-variant">
                <tr>
                  {['Variable', 'n', 'Media', 'Mediana', 'DE', 'Mín', 'Máx', 'IC 95%'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {stats.map((s) => (
                  <tr key={s.field}>
                    <td className="px-3 py-2 font-medium text-on-surface">{s.field}</td>
                    <td className="px-3 py-2 text-on-surface-variant">
                      {s.n}
                      {s.n < 5 && (
                        <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-700" title="BR-RES-004: N<5">
                          N&lt;5
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{s.mean ?? '—'}</td>
                    <td className="px-3 py-2">{s.median ?? '—'}</td>
                    <td className="px-3 py-2">{s.stdDev ?? '—'}</td>
                    <td className="px-3 py-2">{s.min ?? '—'}</td>
                    <td className="px-3 py-2">{s.max ?? '—'}</td>
                    <td className="px-3 py-2">
                      {s.ci95Lower != null && s.ci95Upper != null
                        ? `${s.ci95Lower} – ${s.ci95Upper}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Charts — BR-RES-004: distributions are server-suppressed for N<5.
          Empty distributions render nothing (no small-sample leaking). */}
      {distributions.map((dist) => (
        <section key={dist.field}>
          <h3 className="mb-1 text-sm font-semibold text-on-surface-variant">
            Distribución: {dist.field}
          </h3>
          {dist.categories.length === 0 ? (
            <p className="text-xs text-amber-700">
              Categorías ocultas por tamaño muestral insuficiente (N&lt;5 — BR-RES-004).
            </p>
          ) : dist.categories.length <= 4 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dist.categories}
                    dataKey="count"
                    nameKey="label"
                    cx="50%" cy="50%"
                    outerRadius={80}
                    label={(e: any) => `${e.name}: ${e.value}`}
                  >
                    {dist.categories.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dist.categories}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#4f46e5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      ))}

      {/* Numeric analysis — line / scatter / box plot (spec §10). The physician
          switches chart type with one click and picks axes. BR-RES-004: when the
          selected series has N<5 we hide the chart and surface a warning. */}
      {numFields.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-semibold text-on-surface-variant">Análisis numérico</h3>
            <div className="inline-flex rounded-md border border-outline overflow-hidden">
              {(['line', 'scatter', 'box'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setChartType(t)}
                  className={`px-3 py-1 text-sm ${
                    chartType === t ? 'bg-indigo-600 text-white' : 'bg-surface-lowest text-on-surface-variant hover:bg-surface-low'
                  }`}
                >
                  {t === 'line' ? 'Línea' : t === 'scatter' ? 'Dispersión' : 'Box plot'}
                </button>
              ))}
            </div>
          </div>

          {chartType === 'line' && (
            <NumericFieldSelect
              label="Variable"
              fields={numFields}
              value={effectiveLineField}
              onChange={setLineField}
            />
          )}
          {chartType === 'scatter' && (
            <div className="flex gap-3">
              <NumericFieldSelect label="Eje X" fields={numFields} value={effectiveScatterX} onChange={setScatterX} />
              <NumericFieldSelect label="Eje Y" fields={numFields} value={effectiveScatterY} onChange={setScatterY} />
            </div>
          )}
          {chartType === 'box' && (
            <NumericFieldSelect
              label="Variable"
              fields={numFields}
              value={effectiveBoxField}
              onChange={setBoxField}
            />
          )}

          <NumericChart
            type={chartType}
            rows={rows}
            lineField={effectiveLineField}
            scatterX={effectiveScatterX}
            scatterY={effectiveScatterY}
            boxField={effectiveBoxField}
          />
        </section>
      )}

      {/* Results table — anonymized display fields */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-on-surface-variant">
          Resultados ({rows.length} pacientes)
        </h3>
        {rows.length === 0 ? (
          <p className="text-sm text-on-surface-variant">La consulta no devolvió pacientes.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-outline-variant">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-low text-on-surface-variant">
                <tr>
                  {displayFields.map((f) => (
                    <th
                      key={f}
                      onClick={() => toggleSort(f)}
                      className="cursor-pointer select-none px-3 py-2 text-left font-medium hover:bg-surface-container"
                    >
                      {f} {sort?.field === f ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {sortedRows.slice(0, 200).map((row) => (
                  <tr key={row.patientId} className="hover:bg-surface-low">
                    {displayFields.map((f) => (
                      <td key={f} className="px-3 py-2 text-on-surface-variant">
                        {formatCell(row.fields[f] ?? (row as unknown as Record<string, unknown>)[f])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 200 && (
              <p className="bg-surface-low px-3 py-1.5 text-xs text-on-surface-variant">
                Mostrando 200 de {rows.length} filas. Exporta para ver la cohorte completa.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return (value as Date).toISOString().slice(0, 10);
  return String(value);
}

// ─────────────────────────────────────────────
// Numeric chart sub-components (spec §10)
// ─────────────────────────────────────────────

function NumericFieldSelect({
  label,
  fields,
  value,
  onChange,
}: {
  label: string;
  fields: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-sm">
      <span className="font-medium text-on-surface-variant">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 ml-2 rounded border border-outline px-2 py-1 text-sm"
      >
        {fields.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
    </label>
  );
}

function NumericChart({
  type,
  rows,
  lineField,
  scatterX,
  scatterY,
  boxField,
}: {
  type: 'line' | 'scatter' | 'box';
  rows: ResultRow[];
  lineField: string;
  scatterX: string;
  scatterY: string;
  boxField: string;
}) {
  // BR-RES-004: hide the chart when the series has fewer than 5 points.
  if (type === 'line') {
    const values = numericValues(rows, lineField);
    if (values.length < 5) return <InsufficientSample />;
    const data = values.map((v, i) => ({ index: i + 1, value: v }));
    return (
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="index" type="number" allowDecimals={false} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#4f46e5" dot={false} name={lineField} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === 'scatter') {
    if (!scatterX || !scatterY || scatterX === scatterY) {
      return <p className="text-xs text-on-surface-variant">Elige dos variables distintas para los ejes X e Y.</p>;
    }
    const pairs = rows
      .map((r) => ({ x: r.fields[scatterX], y: r.fields[scatterY] }))
      .filter(
        (p): p is { x: number; y: number } =>
          typeof p.x === 'number' && !Number.isNaN(p.x) && typeof p.y === 'number' && !Number.isNaN(p.y),
      );
    if (pairs.length < 5) return <InsufficientSample />;
    return (
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="x" name={scatterX} />
            <YAxis type="number" dataKey="y" name={scatterY} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name={`${scatterY} vs ${scatterX}`} data={pairs} fill="#4f46e5" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Box plot — Recharts has no native box plot; render a lightweight SVG from
  // the five-number summary computed client-side.
  const values = numericValues(rows, boxField).sort((a, b) => a - b);
  if (values.length < 5) return <InsufficientSample />;
  const min = values[0];
  const max = values[values.length - 1];
  const q1 = quantile(values, 0.25);
  const median = quantile(values, 0.5);
  const q3 = quantile(values, 0.75);
  return <BoxPlot field={boxField} min={min} q1={q1} median={median} q3={q3} max={max} n={values.length} />;
}

function InsufficientSample() {
  return (
    <p className="text-xs text-amber-700">
      Muestra insuficiente (N&lt;5) — BR-RES-004: el gráfico se oculta para evitar re-identificación.
    </p>
  );
}

/**
 * Minimal vertical box plot rendered as SVG (Recharts has no native box plot).
 * Draws whiskers (min–max), a box (Q1–Q3), and the median line. The vertical
 * scale maps [min, max] → chart height.
 */
function BoxPlot({
  field,
  min,
  q1,
  median,
  q3,
  max,
  n,
}: {
  field: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  n: number;
}) {
  const W = 320;
  const H = 220;
  const padTop = 16;
  const padBottom = 36;
  const plotH = H - padTop - padBottom;
  const cx = W / 2;
  const boxW = 64;

  const range = max - min || 1;
  const y = (v: number) => padTop + plotH - ((v - min) / range) * plotH;

  return (
    <div>
      <svg width={W} height={H} role="img" aria-label={`Box plot de ${field}`}>
        {/* Whisker (min–max) */}
        <line x1={cx} y1={y(min)} x2={cx} y2={y(max)} stroke="#9ca3af" strokeWidth={1.5} />
        <line x1={cx - 12} y1={y(min)} x2={cx + 12} y2={y(min)} stroke="#9ca3af" strokeWidth={1.5} />
        <line x1={cx - 12} y1={y(max)} x2={cx + 12} y2={y(max)} stroke="#9ca3af" strokeWidth={1.5} />
        {/* Box (Q1–Q3) */}
        <rect
          x={cx - boxW / 2}
          y={y(q3)}
          width={boxW}
          height={Math.max(y(q1) - y(q3), 2)}
          fill="#e0e7ff"
          stroke="#4f46e5"
          strokeWidth={1.5}
        />
        {/* Median line */}
        <line x1={cx - boxW / 2} y1={y(median)} x2={cx + boxW / 2} y2={y(median)} stroke="#4f46e5" strokeWidth={2} />

        {/* Labels */}
        <text x={cx + boxW / 2 + 8} y={y(max) + 4} fontSize={11} fill="#6b7280">Máx {fmt(max)}</text>
        <text x={cx + boxW / 2 + 8} y={y(q3) + 4} fontSize={11} fill="#6b7280">Q3 {fmt(q3)}</text>
        <text x={cx + boxW / 2 + 8} y={y(median) + 4} fontSize={11} fill="#4f46e5" fontWeight={600}>Med {fmt(median)}</text>
        <text x={cx + boxW / 2 + 8} y={y(q1) + 4} fontSize={11} fill="#6b7280">Q1 {fmt(q1)}</text>
        <text x={cx + boxW / 2 + 8} y={y(min) + 4} fontSize={11} fill="#6b7280">Mín {fmt(min)}</text>
        <text x={cx} y={H - 10} textAnchor="middle" fontSize={12} fill="#374151">{field} (n={n})</text>
      </svg>
    </div>
  );
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
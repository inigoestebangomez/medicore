'use client';

// apps/web/src/components/research/DashboardBuilder/WidgetRenderer.tsx
// Renders a single dashboard widget by chartType (design AD-2). Widgets hold a
// live reference to a ResearchQuery (AD-2): the widget re-runs its query on
// mount, so dashboards reflect current data (spec §4 widget refresh).
//
// Recharts is used for bar/line/scatter/stats; Kaplan-Meier and cross-tab
// widgets lazy-load the dedicated D3-style components (5.5/5.4) so the bundle
// only pays for what's on screen.

import { Suspense, lazy, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { DashboardWidget } from '@medicore/contracts';
import { useExecuteQueryResult } from '@/hooks/useResearch';
import type { ResultRow, FieldStat } from '@/hooks/useResearch';

const SurvivalCurve = lazy(() => import('../SurvivalCurve'));
const CrossTabViewer = lazy(() => import('../CrossTabViewer').then((m) => ({ default: m.CrossTabViewer })));

const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function numericFields(rows: ResultRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) for (const [k, v] of Object.entries(r.fields)) {
    if (typeof v === 'number' && !Number.isNaN(v)) set.add(k);
  }
  return [...set];
}

function StatBoxes({ stats }: { stats: FieldStat[] }) {
  if (stats.length === 0) return <p className="text-sm text-on-surface-variant">Sin estadísticas.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {stats.slice(0, 6).map((s) => (
        <div key={s.field} className="rounded border border-outline-variant bg-surface-lowest p-2">
          <div className="font-semibold text-on-surface">{s.field}</div>
          <div className="text-on-surface-variant">n={s.n} · μ={s.mean ?? '—'}</div>
          <div className="text-on-surface-variant">σ={s.stdDev ?? '—'} · med={s.median ?? '—'}</div>
        </div>
      ))}
    </div>
  );
}

export interface WidgetRendererProps {
  widget: DashboardWidget;
  /** Compact mode used inside the builder grid. */
  height?: number;
}

export function WidgetRenderer({ widget, height = 260 }: WidgetRendererProps) {
  const { data, isLoading, isError } = useExecuteQueryResult(widget.queryId);
  const rows = data?.rows ?? [];
  const stats = data?.stats ?? [];
  const distributions = data?.distributions ?? [];

  const title = widget.title ?? widget.queryId.slice(0, 8);

  const content = useMemo(() => {
    if (isLoading) return <p className="text-sm text-on-surface-variant">Cargando widget…</p>;
    if (isError) return <p className="text-sm text-red-600">Error al ejecutar la consulta del widget.</p>;
    if (rows.length === 0 && stats.length === 0) return <p className="text-sm text-on-surface-variant">Sin resultados.</p>;

    switch (widget.chartType) {
      case 'bar_chart': {
        const dist = distributions[0];
        if (!dist) return <StatBoxes stats={stats} />;
        const data = dist.categories.map((c) => ({ name: c.label, value: c.count }));
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill={COLORS[0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      }
      case 'line_chart': {
        const nf = numericFields(rows);
        const field = widget.displayConfig.displayFields?.[0] ?? nf[0];
        if (!field) return <StatBoxes stats={stats} />;
        const data = rows.map((r, i) => ({ x: i, y: r.fields[field] as number }));
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="x" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="y" stroke={COLORS[1]} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        );
      }
      case 'scatter': {
        const nf = numericFields(rows);
        const x = widget.displayConfig.displayFields?.[0] ?? nf[0];
        const y = widget.displayConfig.displayFields?.[1] ?? nf[1];
        if (!x || !y) return <StatBoxes stats={stats} />;
        const data = rows.map((r) => ({ x: r.fields[x] as number, y: r.fields[y] as number }));
        return (
          <ResponsiveContainer width="100%" height={height}>
            <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="x" tick={{ fontSize: 11 }} />
              <YAxis dataKey="y" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Scatter data={data} fill={COLORS[2]} />
            </ScatterChart>
          </ResponsiveContainer>
        );
      }
      case 'stats':
        return <StatBoxes stats={stats} />;
      case 'kaplan_meier':
        return (
          <Suspense fallback={<p className="text-sm text-on-surface-variant">Cargando curva KM…</p>}>
            {/* Widget refresh: KM pulls its own survival data via the stats endpoint */}
            <SurvivalCurve queryId={widget.queryId} height={height} />
          </Suspense>
        );
      case 'cross_tab': {
        const row = widget.displayConfig.displayFields?.[0];
        const col = widget.displayConfig.groupBy ?? widget.displayConfig.displayFields?.[1];
        if (!row || !col) return <p className="text-sm text-on-surface-variant">Configura row/col del cross-tab.</p>;
        return (
          <Suspense fallback={<p className="text-sm text-on-surface-variant">Cargando cross-tab…</p>}>
            <CrossTabViewer rowField={row} colField={col} queryId={widget.queryId} compact />
          </Suspense>
        );
      }
      default:
        return <StatBoxes stats={stats} />;
    }
  }, [widget, rows, stats, distributions, isLoading, isError, height]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 truncate text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        {title}
      </div>
      <div className="flex-1">{content}</div>
    </div>
  );
}

export default WidgetRenderer;
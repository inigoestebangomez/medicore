'use client';

// apps/web/src/components/research/SurvivalCurve.tsx
// Kaplan-Meier survival curve with 95% CI bands (spec §1, §3). Lazy-loaded by
// the dashboard widget renderer so the bundle only pays for it when a KM
// widget mounts. D3 is not installed in this workspace, so the curve uses
// Recharts (Area band + Line) — visually equivalent and dependency-free.
//
// Data is obtained from POST /research/stats/inferential (test=kaplan_meier);
// the inferential endpoint returns a SurvivalResult for KM tests. The caller
// may also pass a precomputed `data` prop (tests, preview, exports).

import { useEffect } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { SurvivalResult } from '@medicore/contracts';
import { useInferential } from '@/hooks/useResearchV2';

export interface SurvivalCurveProps {
  queryId?: string;
  timeField?: string;
  eventField?: string;
  /** Precomputed KM data (e.g. for export or tests). */
  data?: SurvivalResult;
  height?: number;
}

/** Render the KM curve with CI bands. Pure — given SurvivalResult → JSX. */
export function SurvivalCurvePlot({ data, height = 300 }: { data: SurvivalResult; height?: number }) {
  const chartData = data.timePoints.map((t, i) => ({
    time: t,
    survival: data.survival[i],
    ciLower: data.ciLower?.[i] ?? data.survival[i],
    ciUpper: data.ciUpper?.[i] ?? data.survival[i],
  }));
  return (
    <div data-testid="survival-curve">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <defs>
            <linearGradient id="ciBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0369A1" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#0369A1" stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey="time"
            type="number"
            tick={{ fontSize: 11 }}
            label={{ value: 'Time', position: 'insideBottom', offset: -2, fontSize: 10 }}
          />
          <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} label={{ value: 'Survival', angle: -90, position: 'insideLeft', fontSize: 10 }} />
          <Tooltip />
          {/* CI band: upper area (light) then lower area (background-fill) masks it. */}
          <Area type="stepAfter" dataKey="ciUpper" stroke="none" fill="url(#ciBand)" />
          <Area type="stepAfter" dataKey="ciLower" stroke="none" fill="var(--color-surface-lowest, #ffffff)" />
          <Line type="stepAfter" dataKey="survival" stroke="#0369A1" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap gap-3 text-xs text-on-surface-variant" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {data.medianSurvival !== null && <span>Median survival = {data.medianSurvival.toFixed(1)}</span>}
        {data.logRankP !== null && (
          <span>log-rank p = {data.logRankP < 0.001 ? '<0.001' : data.logRankP.toFixed(3)}</span>
        )}
        {data.warnings.length > 0 && <span className="text-red-700">⚠ {data.warnings.join('; ')}</span>}
      </div>
    </div>
  );
}

export function SurvivalCurve({ queryId, timeField, eventField, data, height }: SurvivalCurveProps) {
  const inferential = useInferential();

  useEffect(() => {
    if (data || !queryId || inferential.isPending) return;
    void inferential.mutateAsync({
      test: 'kaplan_meier',
      data: {
        group1: [],
        group2: [],
        paired: false,
        queryId,
        timeField: timeField ?? 'createdAt',
        eventField: eventField ?? 'event',
      },
    } as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryId, timeField, eventField]);

  if (data) return <SurvivalCurvePlot data={data} height={height} />;
  if (inferential.isPending) return <p className="text-sm text-on-surface-variant">Calculando curva de supervivencia…</p>;
  if (inferential.isError) return <p className="text-sm text-red-600">Error al calcular la curva KM.</p>;

  const result = inferential.data as unknown;
  if (result && typeof result === 'object' && 'survival' in (result as Record<string, unknown>)) {
    return <SurvivalCurvePlot data={result as SurvivalResult} height={height} />;
  }
  if (result && (result as { warnings?: unknown }).warnings) {
    return (
      <p className="text-sm text-on-surface-variant">
        Inferential stats unavailable (
        {Array.isArray((result as { warnings: Array<{ message?: string }> }).warnings)
          ? (result as { warnings: Array<{ message?: string }> }).warnings.map((w) => w.message ?? '').join('; ')
          : ''}
        ).
      </p>
    );
  }
  return <p className="text-sm text-on-surface-variant">Sin datos de supervivencia.</p>;
}

export default SurvivalCurve;
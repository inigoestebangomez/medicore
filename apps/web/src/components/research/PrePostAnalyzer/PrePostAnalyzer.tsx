'use client';

// apps/web/src/components/research/PrePostAnalyzer/PrePostAnalyzer.tsx
// Pre/Post paired analysis builder (M3). Scale selection, configurable pre/
// post temporal windows (days around surgery date), optional surgery-date
// override, and a results panel showing n, mean pre/post, % improvement and
// the Wilcoxon p-value (formatted per BR-RES-006 by the API).

import { useState } from 'react';
import { usePrePostAnalysis, type PrePostResult } from '@/hooks/useStudiesWithBadges';

const SCALE_TYPES = ['SNOT_22', 'VAS_TINNITUS', 'DHI', 'VHI', 'RSI', 'OSA_EPWORTH', 'STOPBANG', 'NOSE'];

export interface PrePostAnalyzerProps {
  studyId: string;
}

export function PrePostAnalyzer({ studyId }: PrePostAnalyzerProps) {
  const [scaleType, setScaleType] = useState('SNOT_22');
  const [surgeryDate, setSurgeryDate] = useState('');
  const [preWindowDays, setPreWindowDays] = useState(30);
  const [postWindowDays, setPostWindowDays] = useState(15);
  const mutation = usePrePostAnalysis();
  const result = (mutation.data ?? null) as PrePostResult | null;

  async function run() {
    await mutation.mutateAsync({
      studyId,
      scaleType,
      ...(surgeryDate ? { surgeryDate } : {}),
      preWindowDays,
      postWindowDays,
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs font-semibold uppercase text-on-surface-variant">
          Escala
          <select
            value={scaleType}
            onChange={(e) => setScaleType(e.target.value)}
            className="mt-1 w-full rounded border border-outline px-2 py-1 text-sm"
            aria-label="Tipo de escala"
          >
            {SCALE_TYPES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold uppercase text-on-surface-variant">
          Fecha de cirugía (opcional)
          <input
            type="date"
            value={surgeryDate}
            onChange={(e) => setSurgeryDate(e.target.value)}
            className="mt-1 w-full rounded border border-outline px-2 py-1 text-sm"
            aria-label="Fecha de cirugía"
          />
        </label>

        <label className="block text-xs font-semibold uppercase text-on-surface-variant">
          Ventana pre (días)
          <input
            type="number"
            min={1}
            value={preWindowDays}
            onChange={(e) => setPreWindowDays(Number(e.target.value) || 30)}
            className="mt-1 w-full rounded border border-outline px-2 py-1 text-sm"
            aria-label="Ventana pre días"
          />
        </label>

        <label className="block text-xs font-semibold uppercase text-on-surface-variant">
          Ventana post (días)
          <input
            type="number"
            min={1}
            value={postWindowDays}
            onChange={(e) => setPostWindowDays(Number(e.target.value) || 15)}
            className="mt-1 w-full rounded border border-outline px-2 py-1 text-sm"
            aria-label="Ventana post días"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => void run()}
        disabled={mutation.isPending}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary disabled:opacity-50"
      >
        {mutation.isPending ? 'Analizando…' : 'Ejecutar análisis pre/post'}
      </button>

      {result && <PrePostResults result={result} />}
    </div>
  );
}

function PrePostResults({ result }: { result: PrePostResult }) {
  return (
    <div className="rounded-md border border-outline p-4" data-testid="pre-post-results">
      <h3 className="mb-2 text-sm font-semibold uppercase text-on-surface-variant">
        Resultados · {result.scaleType} · n = {result.n}
      </h3>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Stat label="Media pre" value={result.meanPre} />
        <Stat label="Media post" value={result.meanPost} />
        <Stat label="Diferencia media" value={result.meanDifference} />
        <Stat label="% mejora" value={result.percentImprovement} suffix="%" />
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-xs uppercase text-on-surface-variant">p (Wilcoxon)</dt>
          <dd className="font-semibold text-on-surface" data-testid="wilcoxon-p">{result.pValue}</dd>
        </div>
      </dl>
      {result.warnings.length > 0 && (
        <ul className="mt-3 text-xs text-on-surface-variant">
          {result.warnings.map((w, i) => (
            <li key={i}>⚠ {w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number | null; suffix?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-on-surface-variant">{label}</dt>
      <dd className="font-semibold text-on-surface">
        {value === null ? '—' : `${value}${suffix ?? ''}`}
      </dd>
    </div>
  );
}

export default PrePostAnalyzer;
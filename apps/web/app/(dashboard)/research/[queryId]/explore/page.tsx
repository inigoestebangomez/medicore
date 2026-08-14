'use client';

// apps/web/app/(dashboard)/research/[queryId]/explore/page.tsx
// Query explorer V2 (spec §8, §9). Loads the real saved query via
// useGetSavedQuery, opens FilterBuilderV2 (field discovery + live preview),
// and lets the physician execute ad-hoc or rerun the saved query. Cross-tab /
// time-series / inferential analytics + the V2 share action are reachable from
// here (toggle sections).

import { useEffect, useRef, useState } from 'react';
import { FilterBuilderV2 } from '@/components/research/FilterBuilderV2';
import { ResearchFieldPicker } from '@/components/research/ResearchFieldPicker';
import { ResultsViewer } from '@/components/research/results-viewer';
import { CrossTabViewer } from '@/components/research/CrossTabViewer';
import { TimeSeriesChart } from '@/components/research/TimeSeriesChart';
import { StatisticalResults } from '@/components/research/StatisticalResults';
import { ShareDialog } from '@/components/research/ShareDialog';
import { useExecuteQuery, useGetSavedQuery } from '@/hooks/useResearch';
import { useExecuteAdHoc, useInferential, type InferentialResult } from '@/hooks/useResearchV2';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import type { Filter, FilterLogic } from '@medicore/contracts';

export default function ExplorePage({ params }: { params: { queryId: string } }) {
  const fieldDiscoveryEnabled = useFeatureFlag('RESEARCH_V2_FIELD_DISCOVERY');
  const { data, isLoading, isError, error } = useGetSavedQuery(params.queryId);

  const [filters, setFilters] = useState<Filter[]>([]);
  const [logic, setLogic] = useState<FilterLogic>('AND');
  const [displayFields, setDisplayFields] = useState<string[]>([]);
  const [section, setSection] = useState<'results' | 'crosstab' | 'timeseries' | 'inferential'>('results');
  const [showShare, setShowShare] = useState(false);

  // Crosstab
  const [rowField, setRowField] = useState('sex');
  const [colField, setColField] = useState('bloodType');

  // Timeseries
  const [metric, setMetric] = useState('createdAt');

  // Inferential
  const inferential = useInferential();
  const [statResult, setStatResult] = useState<InferentialResult | null>(null);

  // Initialize local filter state from the fetched saved query — once per
  // loaded query id (preserves edits while data settles and re-hydrates when
  // the route param swaps to a different query without remounting).
  const initRef = useRef<string | null>(null);
  useEffect(() => {
    if (data && initRef.current !== data.id) {
      setFilters(data.filters ?? []);
      setLogic(data.filterLogic ?? 'AND');
      setDisplayFields(data.displayFields ?? []);
      initRef.current = data.id;
    }
  }, [data]);

  // Results — the mutation id is the route param (stable, available immediately).
  const adhoc = useExecuteAdHoc();
  const exec = useExecuteQuery(params.queryId);

  function run() {
    void exec.mutateAsync({
      filters,
      filterLogic: logic,
      displayFields,
    });
  }

  async function runInferential() {
    const rows = exec.data?.rows ?? adhoc.data?.rows ?? [];
    const group1 = rows
      .map((r) => Number(r.fields[displayFields[0] ?? 'age'] ?? NaN))
      .filter((n) => !Number.isNaN(n));
    const res = await inferential.mutateAsync({
      test: 'ttest_independent',
      data: { group1, group2: [], paired: false },
    } as any);
    setStatResult(res);
  }

  // Loading state — skeleton before the saved query is fetched.
  if (isLoading) {
    return (
      <div className="container mx-auto space-y-4 py-6" aria-busy="true">
        <div className="h-8 w-64 animate-pulse rounded bg-surface-low" />
        <div className="h-40 animate-pulse rounded-md border border-outline-variant bg-surface-low" />
        <div className="h-40 animate-pulse rounded-md border border-outline-variant bg-surface-low" />
        <p className="text-sm text-on-surface-variant">Cargando consulta…</p>
      </div>
    );
  }

  // Error state — distinguish 404 (not found) from generic failures.
  if (isError) {
    const isNotFound = /not found/i.test((error as Error)?.message ?? '');
    return (
      <div className="container mx-auto py-6">
        <p className="text-sm text-red-600">
          {isNotFound
            ? 'Consulta no encontrada'
            : `Error: ${(error as Error)?.message ?? 'No se pudo cargar la consulta'}`}
        </p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="container mx-auto space-y-5 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-on-surface">Explorar · {data.name}</h1>
        <div className="flex gap-2">
          <button onClick={run} className="rounded-md bg-primary px-3 py-1.5 text-sm text-on-primary">Ejecutar</button>
          <button onClick={() => setShowShare(true)} className="rounded-md border border-outline-variant px-3 py-1.5 text-sm text-on-surface">Compartir</button>
        </div>
      </div>

      <FilterBuilderV2
        filters={filters}
        logic={logic}
        onChange={(f, l) => { setFilters(f); setLogic(l); }}
        dataSource={data.dataSource}
        importBatchIds={data.importBatchIds}
        previewFields={displayFields}
        disabled={!fieldDiscoveryEnabled}
      />

      <section className="rounded-md border border-outline-variant bg-surface-low p-4">
        <h2 className="text-sm font-semibold text-on-surface">Campos a mostrar</h2>
        <div className="mt-2">
          <ResearchFieldPicker
            value={displayFields}
            onChange={setDisplayFields}
            disabled={!fieldDiscoveryEnabled}
          />
        </div>
      </section>

      <nav className="flex gap-2 text-sm">
        {(['results', 'crosstab', 'timeseries', 'inferential'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`rounded-md px-3 py-1 ${section === s ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface'}`}
          >
            {s === 'results' ? 'Resultados' : s === 'crosstab' ? 'Cross-tab' : s === 'timeseries' ? 'Serie' : 'Inferencial'}
          </button>
        ))}
      </nav>

      {section === 'results' && (
        exec.data ? (
          <ResultsViewer
            rows={exec.data.rows ?? []}
            displayFields={displayFields}
            stats={exec.data.stats ?? []}
            distributions={exec.data.distributions ?? []}
          />
        ) : <p className="text-sm text-on-surface-variant">Pulsa «Ejecutar» para ver resultados.</p>
      )}

      {section === 'crosstab' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input value={rowField} onChange={(e) => setRowField(e.target.value)} placeholder="fila" className="rounded border border-outline px-2 py-1 text-sm" />
            <input value={colField} onChange={(e) => setColField(e.target.value)} placeholder="columna" className="rounded border border-outline px-2 py-1 text-sm" />
          </div>
          <CrossTabViewer rowField={rowField} colField={colField} queryId={params.queryId} />
        </div>
      )}

      {section === 'timeseries' && (
        <div className="space-y-3">
          <input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="métrica/campo fecha" className="rounded border border-outline px-2 py-1 text-sm" />
          <TimeSeriesChart metric={metric} period="month" queryId={params.queryId} />
        </div>
      )}

      {section === 'inferential' && (
        <div className="space-y-3">
          <button onClick={() => void runInferential()} className="rounded-md bg-primary px-3 py-1.5 text-sm text-on-primary" disabled={inferential.isPending}>
            {inferential.isPending ? 'Calculando…' : 'Ejecutar t-test independiente'}
          </button>
          {statResult && 'statistic' in statResult && <StatisticalResults result={statResult as any} />}
        </div>
      )}

      {showShare && (
        <ShareDialog
          queryId={params.queryId}
          queryName={data.name}
          colleagues={[]}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}

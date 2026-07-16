'use client';

// apps/web/app/(dashboard)/research/[queryId]/page.tsx
// Results page for a saved research query: executes on mount (post -> /execute),
// renders the results table + stats + charts (Recharts, N<5 suppressed), export
// buttons (BR-RES-002 anonymized), and collection management (create a cohort
// from this query's snapshot, BR-RES-003 lock).

import { use, useState } from 'react';
import { useExecuteQueryResult } from '@/hooks/useResearch';
import { ResultsViewer } from '@/components/research/results-viewer';
import { ExportDialog } from '@/components/research/export-dialog';
import { CollectionManager } from '@/components/research/collection-manager';
import type { Filter, FilterLogic } from '@medicore/contracts';
import { FilterBuilder } from '@/components/research/filter-builder';

export default function ResearchQueryResultsPage({ params }: { params: Promise<{ queryId: string }> }) {
  const { queryId } = use(params);
  const result = useExecuteQueryResult(queryId);
  const [overrideFilters, setOverrideFilters] = useState<Filter[] | null>(null);
  const [overrideLogic, setOverrideLogic] = useState<FilterLogic>('AND');

  // The execute hook auto-runs once on mount; results contain the stored
  // filters/config. BR-RES-004 (N<5) is applied server-side.
  const data = result.data;
  const patientIds = data?.rows.map((r) => r.patientId) ?? [];

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Resultados de la consulta</h1>
        <div className="flex items-center gap-2">
          <ExportDialog queryId={queryId} />
          <button
            type="button"
            onClick={() => result.refetch()}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
          >
            Re-ejecutar
          </button>
        </div>
      </div>

      {/* Re-execution includes new imports automatically because the query is
          evaluated live against current patient data (spec §11). */}

      <details className="rounded-md border border-gray-200 p-3">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">
          Modificar filtros para una ejecución ad-hoc (no se guarda)
        </summary>
        <div className="mt-3 space-y-3">
          <FilterBuilder
            filters={overrideFilters ?? data?.appliedFilters ?? []}
            logic={overrideLogic}
            onChange={(f, l) => { setOverrideFilters(f); setOverrideLogic(l); }}
          />
          <button
            type="button"
            onClick={() => result.refetch()}
            disabled={!overrideFilters}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            Aplicar y ejecutar
          </button>
        </div>
      </details>

      {result.isLoading && <p className="text-sm text-gray-500">Ejecutando consulta…</p>}
      {result.isError && (
        <p className="text-sm text-red-600">Error: {(result.error as Error).message}</p>
      )}

      {data && data.totalRows === 0 && (
        <p className="text-sm text-gray-500">La consulta no devolvió pacientes.</p>
      )}

      {data && data.totalRows > 0 && (
        <>
          {/* Only render viz blocks the saved query requested (spec §10). */}
          <ResultsViewer
            rows={data.rows}
            displayFields={data.displayFields}
            stats={data.stats}
            distributions={data.distributions}
          />

          <CollectionManager queryId={queryId} patientIds={patientIds} />
        </>
      )}

      <p className="text-xs text-gray-400">
        BR-RES-001: consulta privada · BR-RES-002: exportación siempre anónima ·
        BR-RES-004: categorías con N&lt;5 ocultas en gráficos y estadística.
      </p>
    </div>
  );
}
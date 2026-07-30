'use client';

// apps/web/app/(dashboard)/research/[queryId]/page.tsx
// Results page for a saved research query: executes on mount (post -> /execute),
// renders the results table + stats + charts (Recharts, N<5 suppressed), export
// buttons (BR-RES-002 anonymized), and collection management (create a cohort
// from this query's snapshot, BR-RES-003 lock).

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useExecuteQueryResult } from '@/hooks/useResearch';
import { ResultsViewer } from '@/components/research/results-viewer';
import { ExportDialog } from '@/components/research/export-dialog';
import { CollectionManager } from '@/components/research/collection-manager';
import type { Filter, FilterLogic } from '@medicore/contracts';
import { FilterBuilder } from '@/components/research/filter-builder';

export default function ResearchQueryResultsPage({ params }: { params: { queryId: string } }) {
  const { queryId } = params;
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
        <h1 className="text-2xl font-semibold text-on-surface">Resultados de la consulta</h1>
        <div className="flex items-center gap-2">
          <ExportDialog queryId={queryId} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => result.refetch()}
          >
            Re-ejecutar
          </Button>
        </div>
      </div>

      {/* Re-execution includes new imports automatically because the query is
          evaluated live against current patient data (spec §11). */}

      <details className="rounded-md border border-outline-variant p-3">
        <summary className="cursor-pointer text-sm font-medium text-on-surface-variant">
          Modificar filtros para una ejecución ad-hoc (no se guarda)
        </summary>
        <div className="mt-3 space-y-3">
          <FilterBuilder
            filters={overrideFilters ?? data?.appliedFilters ?? []}
            logic={overrideLogic}
            onChange={(f, l) => { setOverrideFilters(f); setOverrideLogic(l); }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => result.refetch()}
            disabled={!overrideFilters}
          >
            Aplicar y ejecutar
          </Button>
        </div>
      </details>

      {result.isLoading && <p className="text-sm text-on-surface-variant">Ejecutando consulta…</p>}
      {result.isError && (
        <p className="text-sm text-red-600">Error: {(result.error as Error).message}</p>
      )}

      {data && data.totalRows === 0 && (
        <p className="text-sm text-on-surface-variant">La consulta no devolvió pacientes.</p>
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

      <p className="text-xs text-on-surface-variant/60">
        BR-RES-001: consulta privada · BR-RES-002: exportación siempre anónima ·
        BR-RES-004: categorías con N&lt;5 ocultas en gráficos y estadística.
      </p>
    </div>
  );
}
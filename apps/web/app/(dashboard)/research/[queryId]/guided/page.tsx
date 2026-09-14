'use client';

// apps/web/app/(dashboard)/research/[queryId]/guided/page.tsx
// Guided statistical analysis wizard (V5). Two-path workflow:
// Path 1: descriptive analysis (cohort characterization)
// Path 2: inferential analysis (exposure/outcome comparison)
// Behind the RESEARCH_GUIDED_ANALYSIS feature flag.

import { GuidedAnalysisWizard } from '@/features/guided-analysis';
import { useGetSavedQuery } from '@/hooks/useResearch';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export default function GuidedAnalysisPage({
  params,
}: {
  params: { queryId: string };
}) {
  const guidedEnabled = useFeatureFlag('RESEARCH_GUIDED_ANALYSIS');
  const isNewQuery = params.queryId === 'new';
  const { data: query, isLoading, isError } = useGetSavedQuery(isNewQuery ? '' : params.queryId);

  if (!guidedEnabled) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <h2 className="text-xl font-semibold">Función no disponible</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            El análisis estadístico guiado no está habilitado en este momento.
            Contacte al administrador del sistema.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading && !isNewQuery) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-32 rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (isError || (!query && !isNewQuery)) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <h2 className="text-lg font-semibold text-destructive">
            Consulta no encontrada
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No se pudo cargar la consulta de investigación. Verifique el
            identificador o intente de nuevo.
          </p>
        </div>
      </div>
    );
  }

  // Extract available variables from displayFields
  const availableVariables = query?.displayFields ?? [];
  const cohortSize = query?.lastRunCount ?? 0;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <GuidedAnalysisWizard
        queryId={isNewQuery ? null : params.queryId}
        cohortSize={cohortSize}
        availableVariables={availableVariables}
      />
    </div>
  );
}

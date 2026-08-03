'use client';

// apps/web/src/features/research-form/pages/studies/[id]/builder/page.tsx
// VariableBuilderPage (REQ-FB-001..005): compose the sortable VariableList
// for a study. The draft state is local (React useState) — Zustand/nuqs are
// not dependencies; the list stays server-authoritative via useStudyVariables.

import { useStudy } from '@/hooks/useStudiesWithBadges';
import { useStudyVariables } from '@/features/research-form/api/useResearchForm';
import { VariableList } from '@/features/research-form/components/VariableBuilder/VariableList';
import { VariableLibraryImport } from '@/features/research-form/components/VariableLibrary/ImportToStudyButton';

export function VariableBuilderPage({ studyId }: { studyId: string }) {
  const { data: study, isLoading: studyLoading } = useStudy(studyId);
  const { data: variables, isLoading: varsLoading } = useStudyVariables(studyId);

  if (studyLoading || varsLoading) return <div className="p-6 text-sm text-on-surface-variant">Cargando…</div>;
  if (!study) return <div className="p-6 text-sm text-error">Estudio no encontrado.</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-on-surface">Constructor de variables</h1>
          <p className="text-sm text-on-surface-variant">{study.name}</p>
        </div>
        <VariableLibraryImport studyId={studyId} />
      </div>
      <VariableList studyId={studyId} variables={variables ?? []} />
    </div>
  );
}

export default VariableBuilderPage;
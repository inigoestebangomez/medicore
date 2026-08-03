'use client';

// apps/web/src/features/research-form/components/VariableLibrary/ImportToStudyButton.tsx
// ImportToStudyButton (REQ-FB-002): add a snapshot copy of an org-level
// template into a study (immutable via StudyVariableLink — future template
// edits never mutate existing studies).

import { useVariableTemplates } from '@/features/research-form/api/useResearchForm';
import { useAddVariableFromTemplate } from '@/features/research-form/api/useResearchForm';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export function VariableLibraryImport({ studyId }: { studyId: string }) {
  const enabled = useFeatureFlag('RESEARCH_VARIABLE_LIBRARY');
  const { data } = useVariableTemplates(1, 100);
  const add = useAddVariableFromTemplate(studyId);
  if (!enabled) return null;

  const templates = data?.items ?? [];

  return (
    <label className="text-xs">
      <span className="font-semibold text-on-surface">Importar de la biblioteca</span>
      <select
        value=""
        onChange={async (e) => {
          const templateId = e.target.value;
          if (templateId) await add.mutateAsync({ templateId });
        }}
        className="ml-2 rounded border border-outline bg-surface px-2 py-1"
        disabled={add.isPending}
      >
        <option value="">Elige una plantilla…</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t.type})
          </option>
        ))}
      </select>
    </label>
  );
}

export default VariableLibraryImport;
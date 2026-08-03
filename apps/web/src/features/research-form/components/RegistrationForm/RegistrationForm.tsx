'use client';

// apps/web/src/features/research-form/components/RegistrationForm/RegistrationForm.tsx
// RegistrationForm (REQ-FB-006, REQ-FB-007): render a subject's registration
// form for a FORM/HYBRID study. Reuses the shared consultations DynamicForm
// contract via useRegistrationForm — the template is produced server-side by
// variableFormMapper, so categorical/analysis-bound variables never offer
// free text. EHR auto-fill (REQ-FB-009) is layered on top.

import { useState } from 'react';
import type { StudySubjectResponse } from '@medicore/contracts';
import { DynamicForm } from '@/features/consultations/components/dynamic-form';
import { useRegistrationForm } from '@/features/research-form/api/useResearchForm';
import { EhrAutoFillBanner } from './EhrAutoFillBanner';

export function RegistrationForm({
  studyId,
  patientId,
  autoFillMap,
  onSave,
  saving,
}: {
  studyId: string;
  patientId: string | null;
  autoFillMap: Record<string, string>;
  onSave: (values: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const { data: template, isLoading } = useRegistrationForm(studyId);
  const [values, setValues] = useState<Record<string, unknown>>({});

  if (isLoading) return <p className="text-sm text-on-surface-variant">Cargando formulario…</p>;
  if (!template) return <p className="text-sm text-error">No se pudo cargar el formulario.</p>;

  return (
    <div className="space-y-4">
      <EhrAutoFillBanner
        studyId={studyId}
        patientId={patientId}
        autoFillMap={autoFillMap}
        onApplyOverrides={(overrides) => setValues((prev) => ({ ...prev, ...overrides }))}
      />
      <DynamicForm template={template} values={values} onChange={setValues} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(values)}
          disabled={saving}
          className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar registro'}
        </button>
      </div>
    </div>
  );
}

// Re-export the contract type for callers that compose this component.
export type { StudySubjectResponse };

export default RegistrationForm;
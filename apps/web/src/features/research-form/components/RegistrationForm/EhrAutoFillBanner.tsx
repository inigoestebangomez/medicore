'use client';

// apps/web/src/features/research-form/components/RegistrationForm/EhrAutoFillBanner.tsx
// EhrAutoFillBanner (REQ-FB-009): when a subject is linked to an EHR patient,
// preview the auto-fill overrides and let the physician accept/override them.
// Opted-out fields (managed in the builder via AutoFillToggle) stay empty.

import { useState } from 'react';
import { usePreviewAutoFill } from '@/features/research-form/api/useResearchForm';

export function EhrAutoFillBanner({
  studyId,
  patientId,
  autoFillMap,
  onApplyOverrides,
}: {
  studyId: string;
  patientId: string | null;
  autoFillMap: Record<string, string>;
  onApplyOverrides: (overrides: Record<string, unknown>) => void;
}) {
  const preview = usePreviewAutoFill(studyId);
  const [applied, setApplied] = useState(false);
  if (!patientId || Object.keys(autoFillMap).length === 0) return null;

  const run = async () => {
    const res = await preview.mutateAsync({ patientId, autoFillMap });
    onApplyOverrides(res.overrides);
    setApplied(true);
  };

  return (
    <div className="rounded border border-secondary bg-secondary/10 p-3 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-on-surface">Precarga desde la historia clínica</p>
        <button
          type="button"
          onClick={run}
          disabled={preview.isPending}
          className="rounded bg-secondary px-3 py-1 text-xs font-semibold text-on-secondary disabled:opacity-50"
        >
          {preview.isPending ? 'Cargando…' : applied ? 'Volver a precargar' : 'Precargar del EHR'}
        </button>
      </div>
      {preview.isError && (
        <p className="mt-1 text-xs text-error">No se pudo precargar: {(preview.error as Error).message}</p>
      )}
      {applied && !preview.isError && (
        <p className="mt-1 text-xs text-on-surface-variant">Campos del núcleo fijo precargados. Puedes sobreescribirlos antes de guardar.</p>
      )}
    </div>
  );
}

export default EhrAutoFillBanner;
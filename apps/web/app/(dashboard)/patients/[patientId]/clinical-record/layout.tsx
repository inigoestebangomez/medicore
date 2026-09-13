// apps/web/app/(dashboard)/patients/[patientId]/clinical-record/layout.tsx
// Seven-category clinical record layout.
// Tab navigation lives in PatientHeader (single level).
// Gated behind CLINICAL_RECORD_V2 feature flag.

'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';

interface ClinicalRecordLayoutProps {
  children: React.ReactNode;
  params: { patientId: string };
}

export default function ClinicalRecordLayout({
  children,
}: ClinicalRecordLayoutProps) {
  const isEnabled = useFeatureFlag('CLINICAL_RECORD_V2');

  if (!isEnabled) {
    return (
      <div className="py-8 text-center text-sm text-on-surface-variant">
        <p>La historia clínica estructurada está desactivada.</p>
        <p className="mt-1 text-xs text-on-surface-variant/60">
          Activa el flag <code className="rounded bg-surface-low px-1 py-0.5 font-mono text-xs">CLINICAL_RECORD_V2</code> para habilitarla.
        </p>
      </div>
    );
  }

  return <div data-testid="clinical-record-content">{children}</div>;
}

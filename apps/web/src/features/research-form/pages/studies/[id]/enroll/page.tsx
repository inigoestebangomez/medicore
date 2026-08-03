'use client';

// apps/web/src/features/research-form/pages/studies/[id]/enroll/page.tsx
// EnrollPage (REQ-FB-006, REQ-FB-009): enroll a new subject into a study,
// optionally linked to an EHR patient (auto-fill preview), then capture the
// per-variable values via the RegistrationForm.

import { useState } from 'react';
import { useEnrollSubject } from '@/features/research-form/api/useResearchForm';
import { RegistrationForm } from '@/features/research-form/components/RegistrationForm/RegistrationForm';

const EHR_PATHS: Record<string, string> = {
  // Default auto-fill map for the core fixed variables (REQ-FB-003).
  // The physician can opt out per-field via the builder (AutoFillToggle).
  nombre: 'patient.firstName',
  edad: 'patient.age',
};

export function EnrollPage({ studyId }: { studyId: string }) {
  const enroll = useEnrollSubject(studyId);
  const [patientId, setPatientId] = useState<string>('');
  const [patientNhc, setPatientNhc] = useState<string>('');

  const handleSave = async (values: Record<string, unknown>) => {
    if (!patientNhc.trim()) return;
    await enroll.mutateAsync({
      patientId: patientId.trim() || null,
      patientNhc: patientNhc.trim(),
      values,
      autoFillMap: patientId ? EHR_PATHS : {},
    });
    setPatientId(''); setPatientNhc('');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-lg font-semibold text-on-surface">Registrar paciente</h1>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-semibold text-on-surface">Nº de historia clínica *</span>
          <input
            value={patientNhc}
            onChange={(e) => setPatientNhc(e.target.value)}
            className="w-full rounded border border-outline px-2 py-1"
            required
          />
        </label>
        <label className="text-sm">
          <span className="font-semibold text-on-surface">Vincular paciente del EHR (opcional)</span>
          <input
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder="UUID del paciente"
            className="w-full rounded border border-outline px-2 py-1"
          />
        </label>
      </div>
      <RegistrationForm
        studyId={studyId}
        patientId={patientId || null}
        autoFillMap={patientId ? EHR_PATHS : {}}
        onSave={handleSave}
        saving={enroll.isPending}
      />
      {enroll.isError && <p className="text-sm text-error" role="alert">Error: {(enroll.error as Error).message}</p>}
    </div>
  );
}

export default EnrollPage;
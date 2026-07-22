// apps/web/app/(dashboard)/patients/[patientId]/layout.tsx
// Patient layout — renders PatientHeader with tabs for sub-sections.
// Fetches the patient name so the header shows it on every sub-page (overview,
// consultations, medications, scales, surgeries, reports, imaging).

'use client';

import { usePatient } from '@/hooks/usePatients';
import { PatientHeader } from '@/features/patients/components/patient-header';

interface PatientLayoutProps {
  children: React.ReactNode;
  params: { patientId: string };
}

export default function PatientLayout({ children, params }: PatientLayoutProps) {
  const { data: patient } = usePatient(params.patientId);
  const patientName = patient
    ? `${patient.firstName} ${patient.lastName}`
    : undefined;

  return (
    <div className="space-y-6">
      <PatientHeader patientId={params.patientId} patientName={patientName} />
      <div>{children}</div>
    </div>
  );
}
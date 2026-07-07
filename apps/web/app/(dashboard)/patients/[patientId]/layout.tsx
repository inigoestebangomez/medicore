// apps/web/app/(dashboard)/patients/[patientId]/layout.tsx
// Patient layout — renders PatientHeader with tabs for sub-sections (medications, scales)

import { PatientHeader } from '@/features/patients/components/patient-header';

interface PatientLayoutProps {
  children: React.ReactNode;
  params: { patientId: string };
}

export default function PatientLayout({ children, params }: PatientLayoutProps) {
  return (
    <div className="space-y-6">
      <PatientHeader patientId={params.patientId} />
      <div>{children}</div>
    </div>
  );
}
// apps/web/app/(dashboard)/patients/[patientId]/clinical-record/page.tsx
// Default clinical record page — redirects to patient-data category.

import { redirect } from 'next/navigation';

export default function ClinicalRecordIndex({
  params,
}: {
  params: { patientId: string };
}) {
  redirect(`/patients/${params.patientId}/clinical-record/patient-data`);
}

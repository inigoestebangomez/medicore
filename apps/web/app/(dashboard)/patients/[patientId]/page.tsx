// apps/web/app/(dashboard)/patients/[patientId]/page.tsx
// Patient overview — entry point for the patient detail view.

import Link from 'next/link';
import { PatientActions } from './patient-actions';
import { ClinicalTimeline } from '@/features/patients/components/clinical-timeline';

interface PageProps {
  params: { patientId: string };
}

export default function PatientOverviewPage({ params }: PageProps) {
  const base = `/patients/${params.patientId}`;

  return (
    <div className="container mx-auto space-y-6 py-6">
      <h2 className="text-lg font-semibold text-gray-900">Patient Overview</h2>
      <p className="text-sm text-gray-500">
        Select a section from the tabs above to view clinical records.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={`${base}/medications`}
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <h3 className="text-sm font-medium text-gray-500">Medications</h3>
          <p className="mt-1 text-base font-semibold text-gray-900">View prescriptions →</p>
          <p className="mt-1 text-xs text-gray-400">Active, discontinued, and on-hold medications</p>
        </Link>
        <Link
          href={`${base}/scales`}
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <h3 className="text-sm font-medium text-gray-500">Clinical Scales</h3>
          <p className="mt-1 text-base font-semibold text-gray-900">View score evolution →</p>
          <p className="mt-1 text-xs text-gray-400">SNOT-22, DHI, VHI and custom scales</p>
        </Link>
      </div>

      <PatientActions patientId={params.patientId} />

      <div>
        <h3 className="mb-4 text-base font-semibold text-gray-900">Clinical Timeline</h3>
        <ClinicalTimeline patientId={params.patientId} />
      </div>
    </div>
  );
}
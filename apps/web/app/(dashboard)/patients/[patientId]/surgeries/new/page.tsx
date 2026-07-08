import { PatientHeader } from '@/features/patients/components/patient-header';
import { SurgeryForm } from './surgery-form';

interface PageProps {
  params: { patientId: string };
}

export default function NewSurgeryPage({ params }: PageProps) {
  return (
    <>
      <PatientHeader patientId={params.patientId} />
      <div className="container mx-auto space-y-6 py-6">
        <SurgeryForm patientId={params.patientId} />
      </div>
    </>
  );
}

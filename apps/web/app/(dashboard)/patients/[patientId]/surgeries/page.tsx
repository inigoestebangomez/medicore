import { PatientHeader } from '@/features/patients/components/patient-header';
import { SurgeryList } from './surgery-list';

interface PageProps {
  params: { patientId: string };
}

export default function SurgeriesPage({ params }: PageProps) {
  return (
    <>
      <PatientHeader patientId={params.patientId} />
      <div className="container mx-auto space-y-6 py-6">
        <SurgeryList patientId={params.patientId} />
      </div>
    </>
  );
}

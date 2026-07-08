import { ConsultationForm } from './consultation-form';

export default function NewConsultationPage({ params }: { params: { patientId: string } }) {
  return <ConsultationForm patientId={params.patientId} />;
}

import { ConsultationList } from './consultation-list';

export default function ConsultationsPage({ params }: { params: { patientId: string } }) {
  return <ConsultationList patientId={params.patientId} />;
}

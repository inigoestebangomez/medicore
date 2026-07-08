import { ManualReportForm } from './manual-report-form';

export default function NewReportPage({ params }: { params: { patientId: string } }) {
  return <ManualReportForm patientId={params.patientId} />;
}

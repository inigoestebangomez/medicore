import { GenerateReportForm } from './generate-report-form';

export default function GenerateReportPage({ params }: { params: { patientId: string } }) {
  return <GenerateReportForm patientId={params.patientId} />;
}

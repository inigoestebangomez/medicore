import { ReportList } from './report-list';

export default function ReportsPage({ params }: { params: { patientId: string } }) {
  return <ReportList patientId={params.patientId} />;
}

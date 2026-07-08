import { ReportDetail } from './report-detail';

export default function ReportDetailPage({
  params,
}: {
  params: { patientId: string; reportId: string };
}) {
  return <ReportDetail patientId={params.patientId} reportId={params.reportId} />;
}

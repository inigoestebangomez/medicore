import { SummaryDownload } from './summary-download';

interface PageProps {
  params: { patientId: string };
}

export default function SummaryPage({ params }: PageProps) {
  return (
    <div className="container mx-auto space-y-6 py-6">
      <SummaryDownload patientId={params.patientId} />
    </div>
  );
}

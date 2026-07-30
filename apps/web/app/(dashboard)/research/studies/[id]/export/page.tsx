// apps/web/app/(dashboard)/research/studies/[id]/export/page.tsx
// Export wizard tab (M7). Mounts the ExportWizard for a study.

'use client';

import Link from 'next/link';
import { ExportWizard } from '@/components/research/ExportWizard/ExportWizard';

export default function ExportPage({ params }: { params: { id: string } }) {
  const { id } = params;
  return (
    <div className="container mx-auto space-y-4 py-6">
      <Link href={`/research/studies/${id}`} className="text-xs text-on-surface-variant hover:underline">
        ← Detalle del estudio
      </Link>
      <h1 className="text-lg font-bold text-on-surface">Exportar estudio</h1>
      <ExportWizard studyId={id} studyName={id} />
    </div>
  );
}
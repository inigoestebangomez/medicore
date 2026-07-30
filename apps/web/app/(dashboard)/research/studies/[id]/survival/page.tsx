// apps/web/app/(dashboard)/research/studies/[id]/survival/page.tsx
// Survival analysis tab (M5). Mounts the SurvivalConfigurator for a study.

'use client';

import { use } from 'react';
import Link from 'next/link';
import { SurvivalConfigurator } from '@/components/research/SurvivalConfigurator';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SurvivalPage({ params }: PageProps) {
  const { id } = use(params);
  return (
    <div className="container mx-auto space-y-4 py-6">
      <Link href={`/research/studies/${id}`} className="text-xs text-on-surface-variant hover:underline">
        ← Detalle del estudio
      </Link>
      <h1 className="text-lg font-bold text-on-surface">Análisis de supervivencia</h1>
      <SurvivalConfigurator studyId={id} />
    </div>
  );
}
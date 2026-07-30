'use client';

// apps/web/app/(dashboard)/research/studies/[id]/pre-post/page.tsx
// Pre/post analysis tab (M3). Mounts the PrePostAnalyzer for the study.

import { PrePostAnalyzer } from '@/components/research/PrePostAnalyzer/PrePostAnalyzer';

export default function PrePostPage({ params }: { params: { id: string } }) {
  const { id } = params;
  return (
    <div className="container mx-auto py-6">
      <h1 className="mb-3 text-lg font-bold text-on-surface">Análisis pre/post pareado</h1>
      <PrePostAnalyzer studyId={id} />
    </div>
  );
}
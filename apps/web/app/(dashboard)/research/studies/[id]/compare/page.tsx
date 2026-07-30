// apps/web/app/(dashboard)/research/studies/[id]/compare/page.tsx
// Group comparison tab (M6). Mounts the GroupComparison component for a study.

'use client';

import { use } from 'react';
import Link from 'next/link';
import { GroupComparison } from '@/components/research/GroupComparison';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ComparePage({ params }: PageProps) {
  const { id } = use(params);
  return (
    <div className="container mx-auto space-y-4 py-6">
      <Link href={`/research/studies/${id}`} className="text-xs text-on-surface-variant hover:underline">
        ← Detalle del estudio
      </Link>
      <h1 className="text-lg font-bold text-on-surface">Comparación de grupos</h1>
      <GroupComparison studyId={id} />
    </div>
  );
}
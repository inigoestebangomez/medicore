'use client';

// apps/web/app/(dashboard)/research/studies/[id]/table1/page.tsx
// Table 1 tab (M2). Mounts the TableOneBuilder with the study's catalogue.

import { use } from 'react';
import { TableOneBuilder } from '@/components/research/TableOneBuilder/TableOneBuilder';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TableOnePage({ params }: PageProps) {
  const { id } = use(params);
  return (
    <div className="container mx-auto py-6">
      <h1 className="mb-3 text-lg font-bold text-on-surface">Tabla 1 — Estadística descriptiva</h1>
      <TableOneBuilder studyId={id} />
    </div>
  );
}
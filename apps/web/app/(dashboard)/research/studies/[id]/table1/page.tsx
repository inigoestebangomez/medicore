'use client';

// apps/web/app/(dashboard)/research/studies/[id]/table1/page.tsx
// Table 1 tab (M2). Mounts the TableOneBuilder with the study's catalogue.

import { TableOneBuilder } from '@/components/research/TableOneBuilder/TableOneBuilder';

export default function TableOnePage({ params }: { params: { id: string } }) {
  const { id } = params;
  return (
    <div className="container mx-auto py-6">
      <h1 className="mb-3 text-lg font-bold text-on-surface">Tabla 1 — Estadística descriptiva</h1>
      <TableOneBuilder studyId={id} />
    </div>
  );
}
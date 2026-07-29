'use client';

// apps/web/app/(dashboard)/research/studies/[id]/page.tsx
// Study detail (M8): overview + tabs for table1, compare, survival, export.
// Tabs render placeholders here; Phase 2/3/4 pages mount the real components.

import { use } from 'react';
import Link from 'next/link';
import { useStudy, useStudySuggestions } from '@/hooks/useStudiesWithBadges';
import { StudySuggestionPanel } from '@/components/research/StudySuggestionPanel';

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABEL = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  ARCHIVED: 'Archivado',
  FROZEN: 'Congelado',
} as const;

const TABS = [
  { key: 'table1', label: 'Tabla 1' },
  { key: 'pre-post', label: 'Pre/Post' },
  { key: 'compare', label: 'Comparar' },
  { key: 'survival', label: 'Supervivencia' },
  { key: 'export', label: 'Exportar' },
] as const;

export default function StudyDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: study, isLoading } = useStudy(id);
  const { data: suggestions } = useStudySuggestions(id);

  if (isLoading) return <p className="text-sm text-on-surface-variant">Cargando estudio…</p>;
  if (!study) return <p className="text-sm text-on-surface-variant">Estudio no encontrado.</p>;

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <Link href="/research/studies" className="text-xs text-on-surface-variant hover:underline">
          ← Mis estudios
        </Link>
        <h1 className="mt-1 text-xl font-bold text-on-surface">{study.name}</h1>
        <div className="mt-1 flex items-center gap-3 text-sm text-on-surface-variant">
          <span className="rounded-full bg-surface-low px-2 py-0.5 text-xs font-semibold">
            {STATUS_LABEL[study.status]}
          </span>
          <span>{study.patientCount} pacientes</span>
          {study.cachedAt && (
            <span>Cohorte actualizada: {new Date(study.cachedAt).toLocaleDateString()}</span>
          )}
          {study.status === 'FROZEN' && study.frozenAt && (
            <span>Congelado: {new Date(study.frozenAt).toLocaleDateString()}</span>
          )}
        </div>
        {study.description && (
          <p className="mt-2 text-sm text-on-surface-variant">{study.description}</p>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-on-surface-variant">Sugerencias</h2>
        <StudySuggestionPanel suggestions={suggestions?.suggestions} />
      </section>

      <nav className="flex gap-2 border-b border-outline-variant">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/research/studies/${id}/${t.key}`}
            className="rounded-t border-b-2 border-transparent px-3 py-2 text-sm text-on-surface-variant hover:text-on-surface"
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
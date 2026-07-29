'use client';

// apps/web/src/components/research/MyStudiesDashboard.tsx
// Studies landing (M8): list of studies with status badges, live indicators,
// patient deltas, notification toasts, and quick lifecycle actions.

import { useState } from 'react';
import Link from 'next/link';
import { useStudiesWithBadges, useFreezeStudy, useArchiveStudy } from '@/hooks/useStudiesWithBadges';
import { StudyCard } from './StudyCard';
import { StudySuggestionPanel } from './StudySuggestionPanel';
import type { StudyDTO } from '@/hooks/useStudiesWithBadges';

export interface MyStudiesDashboardProps {
  /** Optional toast callback fired when live cohort notifications increase. */
  onNewPatients?: (studyId: string, studyName: string, newCount: number) => void;
}

const FILTERS: Array<{ label: string; value?: StudyDTO['status'] }> = [
  { label: 'Todos' },
  { label: 'Activos', value: 'ACTIVE' },
  { label: 'Borradores', value: 'DRAFT' },
  { label: 'Archivados', value: 'ARCHIVED' },
  { label: 'Congelados', value: 'FROZEN' },
];

export function MyStudiesDashboard({ onNewPatients }: MyStudiesDashboardProps) {
  const [status, setStatus] = useState<StudyDTO['status'] | undefined>(undefined);
  const { studies, isLoading } = useStudiesWithBadges(status, onNewPatients);

  // Poll a single "suggestions preview" for the first active study for the demo
  // panel; the detail page runs the full analysis. Hooks must be unconditional,
  // so we use a simple guard with the first listed active study.
  const firstActive = studies.find((s) => s.status === 'ACTIVE');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-on-surface">Mis Estudios</h1>
          <p className="text-sm text-on-surface-variant">
            Cohortes en vivo sobre consultas guardadas — recálculo automático al importar.
          </p>
        </div>
        <Link
          href="/research/new"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary hover:opacity-90"
        >
          Nuevo estudio
        </Link>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => setStatus(f.value)}
            className={
              'rounded-full border px-3 py-1 text-xs ' +
              (status === f.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-outline text-on-surface-variant hover:bg-surface-low')
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-sm text-on-surface-variant">Cargando estudios…</div>}

      {!isLoading && studies.length === 0 && (
        <div className="rounded-lg border border-dashed border-outline p-8 text-center text-on-surface-variant">
          No hay estudios. Crea uno desde una consulta guardada.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {studies.map((study) => (
          <StudyActions key={study.id} study={study} />
        ))}
      </div>

      {firstActive && <StudySuggestionPanel />}
    </div>
  );
}

function StudyActions({ study }: { study: StudyDTO }) {
  const freeze = useFreezeStudy(study.id);
  const archive = useArchiveStudy(study.id);
  return (
<StudyCard
        study={study}
        onFreeze={() => {
          if (confirm('¿Congelar el estudio? La cohorte será inmutable (irreversible).')) freeze.mutate();
        }}
        onArchive={() => {
          if (confirm('¿Archivar el estudio? Se pausarán las actualizaciones en vivo.')) archive.mutate();
        }}
      />
  );
}

export default MyStudiesDashboard;
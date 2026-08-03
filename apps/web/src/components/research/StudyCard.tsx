'use client';

// apps/web/src/components/research/StudyCard.tsx
// Card showing a study's name, status badge, live indicator, patient count,
// last-updated, and quick actions (view, freeze, archive).

import Link from 'next/link';
import type { StudyDTO } from '@/hooks/useStudiesWithBadges';

const STATUS_STYLE: Record<StudyDTO['status'], string> = {
  DRAFT: 'bg-surface-low text-on-surface-variant',
  ACTIVE: 'bg-success/15 text-success',
  ARCHIVED: 'bg-surface-low text-on-surface-variant',
  FROZEN: 'bg-primary/15 text-primary',
};

const STATUS_LABEL: Record<StudyDTO['status'], string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  ARCHIVED: 'Archivado',
  FROZEN: 'Congelado',
};

// V4 studyType badge (REQ-FB-008): QUERY (V3) | FORM (new) | HYBRID.
const STUDY_TYPE_STYLE: Record<StudyDTO['studyType'], string> = {
  QUERY: 'bg-surface-low text-on-surface-variant',
  FORM: 'bg-primary/15 text-primary',
  HYBRID: 'bg-secondary/15 text-secondary',
};

const STUDY_TYPE_LABEL: Record<StudyDTO['studyType'], string> = {
  QUERY: 'Query',
  FORM: 'Formulario',
  HYBRID: 'Híbrido',
};

export interface StudyCardProps {
  study: StudyDTO;
  unreadCount?: number;
  onFreeze?: (id: string) => void;
  onArchive?: (id: string) => void;
}

export function StudyCard({ study, unreadCount, onFreeze, onArchive }: StudyCardProps) {
  const updated = study.cachedAt ? new Date(study.cachedAt).toLocaleDateString() : '—';
  return (
    <div className="rounded-lg border border-outline bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/research/studies/${study.id}`}
          className="text-base font-semibold text-on-surface hover:underline"
        >
          {study.name}
        </Link>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STUDY_TYPE_STYLE[study.studyType]}`} title={`Tipo de estudio: ${STUDY_TYPE_LABEL[study.studyType]}`}>
            {STUDY_TYPE_LABEL[study.studyType]}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[study.status]}`}>
            {STATUS_LABEL[study.status]}
          </span>
          {study.status === 'ACTIVE' && (
            <span
              className="inline-flex h-2 w-2 animate-pulse rounded-full bg-success"
              aria-label="Cohorte en vivo"
              title="Cohorte en vivo"
            />
          )}
        </div>
      </div>

      {study.description && (
        <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">{study.description}</p>
      )}

      <div className="mt-3 flex items-center gap-4 text-xs text-on-surface-variant">
        <span>
          <strong className="text-on-surface">{study.patientCount}</strong> pacientes
        </span>
        <span>Actualizado: {updated}</span>
        {unreadCount ? (
          <span className="ml-auto rounded-full bg-error/15 px-2 py-0.5 font-semibold text-error">
            {unreadCount} nuevas
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex gap-2">
        <Link
          href={`/research/studies/${study.id}`}
          className="rounded border border-outline px-2 py-1 text-xs hover:bg-surface-low"
        >
          Ver
        </Link>
        {study.status === 'ACTIVE' && onFreeze && (
          <button
            type="button"
            onClick={() => onFreeze(study.id)}
            className="rounded border border-outline px-2 py-1 text-xs hover:bg-surface-low"
          >
            Congelar
          </button>
        )}
        {study.status === 'ACTIVE' && onArchive && (
          <button
            type="button"
            onClick={() => onArchive(study.id)}
            className="rounded border border-outline px-2 py-1 text-xs hover:bg-surface-low"
          >
            Archivar
          </button>
        )}
      </div>
    </div>
  );
}

export default StudyCard;
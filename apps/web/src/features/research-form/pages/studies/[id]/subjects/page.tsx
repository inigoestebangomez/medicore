'use client';

// apps/web/src/features/research-form/pages/studies/[id]/subjects/page.tsx
// EnrolledSubjectsPage (REQ-FB-006): paginated list of subjects enrolled in
// a study, with the raw JSONB values per variable. Links to the enroll page
// to add a new subject.

import Link from 'next/link';
import { useStudySubjects } from '@/features/research-form/api/useResearchForm';
import { useStudy as useStudyMeta } from '@/hooks/useStudiesWithBadges';

export function EnrolledSubjectsPage({ studyId }: { studyId: string }) {
  const { data: study } = useStudyMeta(studyId);
  const { data, isLoading } = useStudySubjects(studyId, 1, 50);
  if (isLoading) return <p className="p-6 text-sm text-on-surface-variant">Cargando…</p>;
  const items = data?.items ?? [];
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-on-surface">Pacientes inscritos</h1>
          <p className="text-sm text-on-surface-variant">{study?.name ?? '…'}</p>
        </div>
        <Link href={`/research/studies/${studyId}/enroll`} className="rounded bg-primary px-3 py-1 text-xs font-semibold text-on-primary">
          + Registrar paciente
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Aún no hay pacientes inscritos.</p>
      ) : (
        <ul className="divide-y divide-outline rounded border border-outline">
          {items.map((s) => (
            <li key={s.id} className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-on-surface">{s.patientNhc}</span>
                <span className="text-xs text-on-surface-variant">
                  {new Date(s.enrolledAt).toLocaleDateString()} · {Object.keys(s.values).length} valores
                </span>
              </div>
              {s.patientId && <span className="text-xs text-on-surface-variant">EHR: {s.patientId.slice(0, 8)}…</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default EnrolledSubjectsPage;
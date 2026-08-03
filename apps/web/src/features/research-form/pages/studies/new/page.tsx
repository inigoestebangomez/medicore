'use client';

// apps/web/src/features/research-form/pages/studies/new/page.tsx
// StudyNewPage (REQ-FB-008): create a QUERY / FORM / HYBRID study. QUERY and
// HYBRID require a saved research query; FORM omits the cohort entirely.
// On success navigates to the study's variable builder.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StudyType } from '@medicore/contracts';
import { useCreateStudy } from '@/hooks/useStudiesWithBadges';
import { useQueryHistory } from '@/hooks/useResearch';
import { StudyTypeSelector } from '@/features/research-form/components/StudyTypeSelector';

export function StudyNewPage() {
  const router = useRouter();
  const createStudy = useCreateStudy();
  const { data: history } = useQueryHistory(1, 100);

  const [studyType, setStudyType] = useState<StudyType>('QUERY');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [queryId, setQueryId] = useState<string>('');

  const needsQuery = studyType === 'QUERY' || studyType === 'HYBRID';
  const canSubmit =
    name.trim().length > 0 && (!needsQuery || queryId.length > 0) && !createStudy.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const study = await createStudy.mutateAsync({
      name: name.trim(),
      studyType,
      queryId: needsQuery ? queryId : null,
      description: description.trim() || undefined,
    });
    router.push(`/research/studies/${study.id}/builder`);
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-5 p-6">
      <h1 className="text-xl font-semibold text-on-surface">Nuevo estudio</h1>

      <StudyTypeSelector value={studyType} onChange={setStudyType} />

      <div className="space-y-1">
        <label htmlFor="study-name" className="text-sm font-semibold text-on-surface">
          Nombre
        </label>
        <input
          id="study-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-outline bg-surface px-3 py-2 text-sm"
          placeholder="p. ej. Cirugía robótica ORL"
          required
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="study-desc" className="text-sm font-semibold text-on-surface">
          Descripción (opcional)
        </label>
        <textarea
          id="study-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded border border-outline bg-surface px-3 py-2 text-sm"
          rows={3}
        />
      </div>

      {needsQuery && (
        <div className="space-y-1">
          <label htmlFor="study-query" className="text-sm font-semibold text-on-surface">
            Consulta guardada (cohorte)
          </label>
          <select
            id="study-query"
            value={queryId}
            onChange={(e) => setQueryId(e.target.value)}
            className="w-full rounded border border-outline bg-surface px-3 py-2 text-sm"
            required
          >
            <option value="">Selecciona una consulta…</option>
            {(history?.items ?? []).map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {createStudy.isError && (
        <p className="text-sm text-error" role="alert">
          Error al crear el estudio: {(createStudy.error as Error).message}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
      >
        {createStudy.isPending ? 'Creando…' : 'Crear estudio'}
      </button>
    </form>
  );
}

export default StudyNewPage;
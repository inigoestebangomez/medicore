// apps/web/app/(dashboard)/patients/[patientId]/clinical-record/current-illness/page.tsx
// Category: Current Illness (Enfermedad actual) — spec §3.
// Structured symptoms, duration, onset, evolution, narrative.

'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useCurrentIllnessEntries, useCreateCurrentIllness } from '@/hooks/useClinicalRecord';
import type { CurrentIllnessResponse, DurationUnit } from '@medicore/contracts';

const DURATION_UNITS: { value: DurationUnit; label: string }[] = [
  { value: 'HOURS', label: 'Horas' },
  { value: 'DAYS', label: 'Días' },
  { value: 'WEEKS', label: 'Semanas' },
  { value: 'MONTHS', label: 'Meses' },
  { value: 'YEARS', label: 'Años' },
];

export default function CurrentIllnessPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { entries, isLoading } = useCurrentIllnessEntries(patientId);
  const createMutation = useCreateCurrentIllness(patientId);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Enfermedad actual</h2>
          <p className="text-sm text-on-surface-variant">
            Síntomas, duración, inicio y evolución del proceso actual.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
          data-testid="toggle-illness-form"
        >
          {showForm ? 'Cancelar' : 'Nueva enfermedad actual'}
        </button>
      </header>

      {showForm && (
        <IllnessForm
          patientId={patientId}
          onSubmit={async (input) => {
            await createMutation.mutateAsync(input);
            setShowForm(false);
          }}
          isPending={createMutation.isPending}
          error={createMutation.error?.message}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg border border-outline-variant bg-surface-low" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <IllnessEntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function IllnessForm({
  patientId,
  onSubmit,
  isPending,
  error,
}: {
  patientId: string;
  onSubmit: (input: any) => Promise<void>;
  isPending: boolean;
  error?: string;
}) {
  const [symptoms, setSymptoms] = useState('');
  const [durationValue, setDurationValue] = useState('');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('DAYS');
  const [onset, setOnset] = useState('');
  const [evolution, setEvolution] = useState('');
  const [narrative, setNarrative] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      symptoms,
      durationValue: durationValue ? Number(durationValue) : null,
      durationUnit: durationValue ? durationUnit : null,
      onset: onset ? new Date(onset).toISOString() : null,
      evolution: evolution || null,
      narrative: narrative || null,
      provenance: {
        sourceType: 'manual',
        authorId: patientId,
        recordedAt: new Date().toISOString(),
        reviewState: 'UNREVIEWED',
      },
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-outline-variant bg-surface-lowest p-4"
      data-testid="illness-form"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-on-surface-variant">
          Síntomas *
        </label>
        <textarea
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          placeholder="Describa los síntomas principales..."
          required
          rows={3}
          className="w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60"
          data-testid="illness-symptoms"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-on-surface-variant">
            Duración
          </label>
          <input
            type="number"
            value={durationValue}
            onChange={(e) => setDurationValue(e.target.value)}
            min={0}
            placeholder="Ej: 5"
            className="w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60"
            data-testid="illness-duration-value"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-on-surface-variant">
            Unidad
          </label>
          <select
            value={durationUnit}
            onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
            className="w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-surface"
            data-testid="illness-duration-unit"
          >
            {DURATION_UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-on-surface-variant">
            Fecha de inicio
          </label>
          <input
            type="date"
            value={onset}
            onChange={(e) => setOnset(e.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-surface"
            data-testid="illness-onset"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-on-surface-variant">
          Evolución
        </label>
        <textarea
          value={evolution}
          onChange={(e) => setEvolution(e.target.value)}
          placeholder="Cómo han evolucionado los síntomas..."
          rows={2}
          className="w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60"
          data-testid="illness-evolution"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-on-surface-variant">
          Narrativa clínica
        </label>
        <textarea
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
          placeholder="Contexto adicional, observaciones..."
          rows={2}
          className="w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60"
          data-testid="illness-narrative"
        />
      </div>

      {error && (
        <p className="text-sm text-rose-400" data-testid="illness-form-error">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || !symptoms.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
          data-testid="illness-submit"
        >
          {isPending ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

function IllnessEntryCard({ entry }: { entry: CurrentIllnessResponse }) {
  const durationLabel = entry.durationValue != null && entry.durationUnit
    ? `${entry.durationValue} ${DURATION_UNITS.find((u) => u.value === entry.durationUnit)?.label.toLowerCase() ?? entry.durationUnit}`
    : null;

  return (
    <div
      className="rounded-lg border border-outline-variant bg-surface-lowest p-4"
      data-testid={`illness-entry-${entry.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-on-surface">{entry.symptoms}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
            {durationLabel && (
              <span className="inline-flex items-center gap-1">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {durationLabel}
              </span>
            )}
            {entry.onset && (
              <span>Inicio: {new Date(entry.onset).toLocaleDateString('es-ES')}</span>
            )}
            <span>Fuente: {entry.provenance.sourceType}</span>
          </div>
        </div>
      </div>
      {entry.evolution && (
        <div className="mt-3 rounded-md bg-surface-low p-3">
          <p className="text-xs font-medium text-on-surface-variant/60">Evolución</p>
          <p className="mt-1 text-sm text-on-surface-variant">{entry.evolution}</p>
        </div>
      )}
      {entry.narrative && (
        <div className="mt-2 rounded-md bg-surface-low p-3">
          <p className="text-xs font-medium text-on-surface-variant/60">Narrativa</p>
          <p className="mt-1 text-sm text-on-surface-variant">{entry.narrative}</p>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-outline-variant py-12 text-center">
      <p className="text-sm text-on-surface-variant">
        No hay registros de enfermedad actual.
      </p>
      <p className="mt-1 text-xs text-on-surface-variant/60">
        Pulsa &quot;Nueva enfermedad actual&quot; para registrar el proceso actual.
      </p>
    </div>
  );
}

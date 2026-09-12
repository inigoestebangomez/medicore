// apps/web/app/(dashboard)/patients/[patientId]/clinical-record/history/page.tsx
// Category: History (Antecedentes) — spec §2.
// Structured personal, allergy, surgical, toxic-habit, profession, family, ECOG data.

'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useHistoryEntries, useCreateHistoryEntry } from '@/hooks/useClinicalRecord';
import type { HistoryEntryResponse, HistoryEntryType, ReviewState } from '@medicore/contracts';

const ENTRY_TYPES: { value: HistoryEntryType; label: string }[] = [
  { value: 'PERSONAL', label: 'Antecedentes personales' },
  { value: 'ALLERGY', label: 'Alergias' },
  { value: 'SURGICAL', label: 'Antecedentes quirúrgicos' },
  { value: 'TOXIC_HABIT', label: 'Hábitos tóxicos' },
  { value: 'PROFESSION', label: 'Profesión' },
  { value: 'FAMILY', label: 'Antecedentes familiares' },
  { value: 'ECOG', label: 'ECOG' },
];

const REVIEW_LABELS: Record<string, { label: string; className: string }> = {
  UNREVIEWED: { label: 'Sin revisar', className: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  CONFIRMED: { label: 'Confirmado', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  REJECTED: { label: 'Rechazado', className: 'bg-rose-500/15 text-rose-400 border-rose-500/20' },
};

export default function HistoryPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { entries, isLoading } = useHistoryEntries(patientId);
  const createMutation = useCreateHistoryEntry(patientId);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Antecedentes</h2>
          <p className="text-sm text-on-surface-variant">
            Historial clínico estructurado: alergias, cirugía, hábitos, familia y ECOG.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
          data-testid="toggle-history-form"
        >
          {showForm ? 'Cancelar' : 'Nuevo antecedente'}
        </button>
      </header>

      {showForm && (
        <HistoryForm
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
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-outline-variant bg-surface-low" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <HistoryEntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryForm({
  patientId,
  onSubmit,
  isPending,
  error,
}: {
  patientId: string;
  onSubmit: (input: {
    entryType: HistoryEntryType;
    key: string;
    value: string;
    provenance: {
      sourceType: string;
      authorId: string;
      recordedAt: string;
      reviewState: ReviewState;
    };
  }) => Promise<void>;
  isPending: boolean;
  error?: string;
}) {
  const [entryType, setEntryType] = useState<HistoryEntryType>('PERSONAL');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      entryType,
      key,
      value,
      provenance: {
        sourceType: 'manual',
        authorId: patientId, // In production: from auth context
        recordedAt: new Date().toISOString(),
        reviewState: 'UNREVIEWED' as ReviewState,
      },
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-outline-variant bg-surface-lowest p-4"
      data-testid="history-form"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-on-surface-variant">
            Tipo
          </label>
          <select
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as HistoryEntryType)}
            className="w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-surface"
            data-testid="history-entry-type"
          >
            {ENTRY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-on-surface-variant">
            Clave
          </label>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Ej: Diabetes tipo 2"
            required
            className="w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60"
            data-testid="history-key"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-on-surface-variant">
          Valor
        </label>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Detalles del antecedente..."
          rows={3}
          className="w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60"
          data-testid="history-value"
        />
      </div>
      {error && (
        <p className="text-sm text-rose-400" data-testid="history-form-error">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || !key.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
          data-testid="history-submit"
        >
          {isPending ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

function HistoryEntryCard({ entry }: { entry: HistoryEntryResponse }) {
  const typeLabel = ENTRY_TYPES.find((t) => t.value === entry.entryType)?.label ?? entry.entryType;
  const review = REVIEW_LABELS[entry.provenance.reviewState] ?? REVIEW_LABELS.UNREVIEWED;

  return (
    <div
      className="rounded-lg border border-outline-variant bg-surface-lowest p-4"
      data-testid={`history-entry-${entry.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase text-on-surface-variant/60">
              {typeLabel}
            </span>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${review.className}`}>
              {review.label}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-on-surface">{entry.key}</p>
          {entry.value && (
            <p className="mt-1 text-sm text-on-surface-variant">{entry.value}</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant/60">
        <span>Registrado: {new Date(entry.provenance.recordedAt).toLocaleDateString('es-ES')}</span>
        <span>·</span>
        <span>Fuente: {entry.provenance.sourceType}</span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-outline-variant py-12 text-center">
      <p className="text-sm text-on-surface-variant">
        No hay antecedentes registrados.
      </p>
      <p className="mt-1 text-xs text-on-surface-variant/60">
        Pulsa &quot;Nuevo antecedente&quot; para añadir los primeros datos.
      </p>
    </div>
  );
}

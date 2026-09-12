// apps/web/app/(dashboard)/patients/[patientId]/clinical-record/physical-exam/page.tsx
// Category: Physical Examination (Exploración física) — spec §4.
// Template-driven fields, custom findings, version indicator.

'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { usePhysicalExamRecords, useCreateExamRecord } from '@/hooks/useClinicalRecord';
import type {
  PhysicalExamRecordResponse,
  ExamTemplateField,
  CustomFinding,
} from '@medicore/contracts';

// Mock template — in production, templates come from the API.
const DEFAULT_TEMPLATE: {
  id: string;
  specialty: string;
  version: number;
  fields: ExamTemplateField[];
} = {
  id: 'tpl-general-001',
  specialty: 'Medicina General',
  version: 1,
  fields: [
    { key: 'blood_pressure', label: 'Tensión arterial', type: 'TEXT', required: false },
    { key: 'heart_rate', label: 'Frecuencia cardíaca (lpm)', type: 'NUMBER', required: false },
    { key: 'temperature', label: 'Temperatura (°C)', type: 'NUMBER', required: false },
    { key: 'spo2', label: 'Saturación O₂ (%)', type: 'NUMBER', required: false },
    { key: 'general_appearance', label: 'Aspecto general', type: 'SELECT', required: false, options: ['Normal', 'Pálido', 'Ictérico', 'Cianótico'] },
  ],
};

export default function PhysicalExamPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { records, isLoading } = usePhysicalExamRecords(patientId);
  const createMutation = useCreateExamRecord(patientId);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Exploración física</h2>
          <p className="text-sm text-on-surface-variant">
            Registros de exploración con plantillas versionadas. Los registros antiguos mantienen su snapshot.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
          data-testid="toggle-exam-form"
        >
          {showForm ? 'Cancelar' : 'Nueva exploración'}
        </button>
      </header>

      {showForm && (
        <ExamBuilder
          patientId={patientId}
          template={DEFAULT_TEMPLATE}
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
      ) : records.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <ExamRecordCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExamBuilder({
  patientId,
  template,
  onSubmit,
  isPending,
  error,
}: {
  patientId: string;
  template: { id: string; specialty: string; version: number; fields: ExamTemplateField[] };
  onSubmit: (input: any) => Promise<void>;
  isPending: boolean;
  error?: string;
}) {
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const [customFindings, setCustomFindings] = useState<CustomFinding[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleFieldChange = (key: string, val: string | number | boolean) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const addCustomFinding = () => {
    if (newLabel.trim() && newValue.trim()) {
      setCustomFindings((prev) => [...prev, { label: newLabel.trim(), value: newValue.trim() }]);
      setNewLabel('');
      setNewValue('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      patientId,
      templateId: template.id,
      templateVersion: template.version,
      values,
      customFindings: customFindings.length > 0 ? customFindings : [],
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
      data-testid="exam-builder"
    >
      {/* Template version indicator */}
      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
        <span className="rounded-md bg-surface-low px-2 py-1 font-mono">
          {template.specialty}
        </span>
        <span className="rounded-md bg-secondary-container/20 px-2 py-1 text-secondary">
          v{template.version}
        </span>
      </div>

      {/* Template fields */}
      <div className="grid gap-4 md:grid-cols-2">
        {template.fields.map((field) => (
          <div key={field.key}>
            <label className="mb-1 block text-xs font-medium text-on-surface-variant">
              {field.label}
              {field.required && <span className="text-rose-400"> *</span>}
            </label>
            {field.type === 'SELECT' ? (
              <select
                value={String(values[field.key] ?? '')}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-surface"
                data-testid={`exam-field-${field.key}`}
              >
                <option value="">—</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.type === 'BOOLEAN' ? (
              <input
                type="checkbox"
                checked={Boolean(values[field.key])}
                onChange={(e) => handleFieldChange(field.key, e.target.checked)}
                className="rounded border-outline-variant"
                data-testid={`exam-field-${field.key}`}
              />
            ) : (
              <input
                type={field.type === 'NUMBER' ? 'number' : 'text'}
                value={String(values[field.key] ?? '')}
                onChange={(e) =>
                  handleFieldChange(
                    field.key,
                    field.type === 'NUMBER' ? Number(e.target.value) : e.target.value,
                  )
                }
                className="w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60"
                data-testid={`exam-field-${field.key}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Custom findings */}
      <div className="space-y-2 border-t border-outline-variant pt-4">
        <p className="text-xs font-medium text-on-surface-variant">
          Hallazgos personalizados
        </p>
        {customFindings.map((cf, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="font-medium text-on-surface">{cf.label}:</span>
            <span className="text-on-surface-variant">{cf.value}</span>
            <button
              type="button"
              onClick={() => setCustomFindings((prev) => prev.filter((_, j) => j !== i))}
              className="ml-auto text-xs text-rose-400 hover:text-rose-300"
            >
              Eliminar
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Etiqueta"
            className="flex-1 rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60"
            data-testid="custom-finding-label"
          />
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Valor"
            className="flex-1 rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60"
            data-testid="custom-finding-value"
          />
          <button
            type="button"
            onClick={addCustomFinding}
            disabled={!newLabel.trim() || !newValue.trim()}
            className="rounded-lg bg-surface-low px-3 py-2 text-sm text-on-surface-variant hover:text-on-surface disabled:opacity-50"
            data-testid="add-custom-finding"
          >
            Añadir
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-rose-400" data-testid="exam-form-error">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
          data-testid="exam-submit"
        >
          {isPending ? 'Guardando...' : 'Guardar exploración'}
        </button>
      </div>
    </form>
  );
}

function ExamRecordCard({ record }: { record: PhysicalExamRecordResponse }) {
  const snapshot = record.templateSchemaSnapshot as { specialty?: string } | null;

  return (
    <div
      className="rounded-lg border border-outline-variant bg-surface-lowest p-4"
      data-testid={`exam-record-${record.id}`}
    >
      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
        <span className="rounded-md bg-surface-low px-2 py-1 font-mono">
          {snapshot?.specialty ?? 'Exploración'}
        </span>
        <span className="rounded-md bg-secondary-container/20 px-2 py-1 text-secondary">
          v{record.templateVersion}
        </span>
        <span>·</span>
        <span>{new Date(record.createdAt).toLocaleDateString('es-ES')}</span>
      </div>

      {Object.keys(record.values).length > 0 && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {Object.entries(record.values).map(([key, val]) => (
            <div key={key} className="flex items-baseline justify-between text-sm">
              <span className="text-on-surface-variant">{key}:</span>
              <span className="font-medium text-on-surface">{String(val)}</span>
            </div>
          ))}
        </div>
      )}

      {record.customFindings.length > 0 && (
        <div className="mt-3 border-t border-outline-variant pt-3">
          <p className="text-xs font-medium text-on-surface-variant/60">Hallazgos personalizados</p>
          {record.customFindings.map((cf, i) => (
            <p key={i} className="mt-1 text-sm text-on-surface-variant">
              <span className="font-medium text-on-surface">{cf.label}:</span> {cf.value}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-outline-variant py-12 text-center">
      <p className="text-sm text-on-surface-variant">No hay exploraciones registradas.</p>
      <p className="mt-1 text-xs text-on-surface-variant/60">
        Pulsa &quot;Nueva exploración&quot; para registrar una exploración física.
      </p>
    </div>
  );
}

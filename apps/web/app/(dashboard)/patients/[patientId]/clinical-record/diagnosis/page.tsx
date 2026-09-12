// apps/web/app/(dashboard)/patients/[patientId]/clinical-record/diagnosis/page.tsx
// Category: Diagnosis (Diagnóstico) — spec §6.
// Diagnosis picker with CIE-10-ES/SNOMED search, status lifecycle.

'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  useDiagnoses,
  useCreateDiagnosis,
  useUpdateDiagnosisStatus,
} from '@/hooks/useClinicalRecord';
import type {
  DiagnosisResponse,
  DiagnosisCodeSystem,
  DiagnosisStatus,
} from '@medicore/contracts';

const STATUS_CONFIG: Record<
  DiagnosisStatus,
  { label: string; className: string }
> = {
  ACTIVE: {
    label: 'Activo',
    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  },
  RESOLVED: {
    label: 'Resuelto',
    className: 'bg-aqua-500/15 text-aqua-400 border-aqua-500/20',
  },
  DISCARDED: {
    label: 'Descartado',
    className: 'bg-surface-low text-on-surface-variant/60 border-outline-variant',
  },
};

// Mock catalog for search — in production, this calls the clinical-codes API.
const MOCK_CATALOG = [
  { code: 'E11.9', description: 'Diabetes mellitus tipo 2, sin mención de complicación', system: 'CIE-10-ES' as const },
  { code: 'I10', description: 'Hipertensión esencial (primaria)', system: 'CIE-10-ES' as const },
  { code: 'J06.9', description: 'Infección aguda de las vías respiratorias superiores', system: 'CIE-10-ES' as const },
  { code: 'M54.5', description: 'Dorsalgia baja', system: 'CIE-10-ES' as const },
  { code: 'K21.0', description: 'Enfermedad por reflujo gastroesofágico con esofagitis', system: 'CIE-10-ES' as const },
  { code: 'J45.9', description: 'Asma, sin otra especificación', system: 'CIE-10-ES' as const },
  { code: 'E78.5', description: 'Hiperlipidemia, sin otra especificación', system: 'CIE-10-ES' as const },
  { code: 'F32.9', description: 'Episodio depresivo, sin especificación', system: 'CIE-10-ES' as const },
];

export default function DiagnosisPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { diagnoses, isLoading } = useDiagnoses(patientId);
  const createMutation = useCreateDiagnosis(patientId);
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Diagnóstico</h2>
          <p className="text-sm text-on-surface-variant">
            Diagnósticos codificados (CIE-10-ES / SNOMED) con estado clínico.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
          data-testid="toggle-diagnosis-picker"
        >
          {showPicker ? 'Cancelar' : 'Nuevo diagnóstico'}
        </button>
      </header>

      {showPicker && (
        <DiagnosisPicker
          patientId={patientId}
          onSubmit={async (input) => {
            await createMutation.mutateAsync(input);
            setShowPicker(false);
          }}
          isPending={createMutation.isPending}
          error={createMutation.error?.message}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border border-outline-variant bg-surface-low" />
          ))}
        </div>
      ) : diagnoses.length === 0 ? (
        <EmptyState />
      ) : (
        <DiagnosisList diagnoses={diagnoses} patientId={patientId} />
      )}
    </div>
  );
}

function DiagnosisPicker({
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSystem, setActiveSystem] = useState<DiagnosisCodeSystem>('CIE-10-ES');
  const [selectedCode, setSelectedCode] = useState<{
    code: string;
    description: string;
    system: DiagnosisCodeSystem;
  } | null>(null);
  const [variables, setVariables] = useState('');

  const filteredResults = MOCK_CATALOG.filter(
    (c) =>
      c.system === activeSystem &&
      (c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const handleSelect = useCallback(
    (code: { code: string; description: string; system: DiagnosisCodeSystem }) => {
      setSelectedCode(code);
    },
    [],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCode) return;

    let parsedVariables: Record<string, string | number | boolean> = {};
    if (variables.trim()) {
      try {
        parsedVariables = JSON.parse(variables);
      } catch {
        // Ignore invalid JSON — variables are optional
      }
    }

    onSubmit({
      patientId,
      system: selectedCode.system,
      code: selectedCode.code,
      description: selectedCode.description,
      catalogVersion: '2024',
      status: 'ACTIVE',
      variables: parsedVariables,
      provenance: {
        sourceType: 'manual',
        authorId: patientId,
        recordedAt: new Date().toISOString(),
        reviewState: 'UNREVIEWED',
      },
    });
  };

  return (
    <div
      className="space-y-4 rounded-lg border border-outline-variant bg-surface-lowest p-4"
      data-testid="diagnosis-picker"
    >
      {/* Catalog search */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-low p-0.5">
            <button
              type="button"
              onClick={() => { setActiveSystem('CIE-10-ES'); setSelectedCode(null); }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeSystem === 'CIE-10-ES'
                  ? 'bg-secondary-container/20 text-secondary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              data-testid="system-cie10"
            >
              CIE-10-ES
            </button>
            <button
              type="button"
              onClick={() => { setActiveSystem('SNOMED'); setSelectedCode(null); }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeSystem === 'SNOMED'
                  ? 'bg-secondary-container/20 text-secondary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              data-testid="system-snomed"
            >
              SNOMED
            </button>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Buscar en ${activeSystem}...`}
            className="flex-1 rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60"
            data-testid="diagnosis-search"
          />
        </div>

        {/* Search results */}
        <div className="max-h-48 overflow-y-auto rounded-lg border border-outline-variant">
          {searchQuery.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-on-surface-variant/60">
              Escribe para buscar diagnósticos
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-on-surface-variant/60">
              Sin resultados para &quot;{searchQuery}&quot;
            </div>
          ) : (
            filteredResults.map((code) => (
              <button
                key={code.code}
                type="button"
                onClick={() => handleSelect(code)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  selectedCode?.code === code.code
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-surface-low'
                }`}
                data-testid={`diagnosis-option-${code.code}`}
              >
                <span className="flex-shrink-0 font-mono text-sm font-medium text-secondary w-16">
                  {code.code}
                </span>
                <span className="text-sm text-on-surface">{code.description}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Selected code + submit */}
      {selectedCode && (
        <div className="space-y-3 border-t border-outline-variant pt-4">
          <div className="rounded-lg bg-surface-low p-3">
            <p className="text-xs font-medium text-on-surface-variant/60">Seleccionado</p>
            <p className="mt-1 text-sm font-medium text-on-surface">
              <span className="font-mono text-secondary">{selectedCode.code}</span>
              {' — '}
              {selectedCode.description}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-on-surface-variant">
              Variables clínicas (JSON, opcional)
            </label>
            <input
              type="text"
              value={variables}
              onChange={(e) => setVariables(e.target.value)}
              placeholder='{"estadio": "II"}'
              className="w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60"
              data-testid="diagnosis-variables"
            />
          </div>
          {error && (
            <p className="text-sm text-rose-400" data-testid="diagnosis-form-error">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
              data-testid="diagnosis-submit"
            >
              {isPending ? 'Guardando...' : 'Añadir diagnóstico'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DiagnosisList({
  diagnoses,
  patientId,
}: {
  diagnoses: DiagnosisResponse[];
  patientId: string;
}) {
  const active = diagnoses.filter((d) => d.status === 'ACTIVE');
  const resolved = diagnoses.filter((d) => d.status === 'RESOLVED');
  const discarded = diagnoses.filter((d) => d.status === 'DISCARDED');

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <DiagnosisGroup
          title="Diagnósticos activos"
          diagnoses={active}
          patientId={patientId}
        />
      )}
      {resolved.length > 0 && (
        <DiagnosisGroup
          title="Resueltos"
          diagnoses={resolved}
          patientId={patientId}
        />
      )}
      {discarded.length > 0 && (
        <DiagnosisGroup
          title="Descartados"
          diagnoses={discarded}
          patientId={patientId}
        />
      )}
    </div>
  );
}

function DiagnosisGroup({
  title,
  diagnoses,
  patientId,
}: {
  title: string;
  diagnoses: DiagnosisResponse[];
  patientId: string;
}) {
  return (
    <section className="space-y-3">
      <h4 className="text-sm font-medium text-on-surface-variant">{title}</h4>
      {diagnoses.map((dx) => (
        <DiagnosisCard key={dx.id} diagnosis={dx} patientId={patientId} />
      ))}
    </section>
  );
}

function DiagnosisCard({
  diagnosis,
  patientId,
}: {
  diagnosis: DiagnosisResponse;
  patientId: string;
}) {
  const statusMutation = useUpdateDiagnosisStatus(patientId);
  const statusConfig = STATUS_CONFIG[diagnosis.status];

  return (
    <div
      className="rounded-lg border border-outline-variant bg-surface-lowest p-4"
      data-testid={`diagnosis-${diagnosis.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-secondary">
              {diagnosis.code}
            </span>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusConfig.className}`}>
              {statusConfig.label}
            </span>
            <span className="text-xs text-on-surface-variant/60">
              {diagnosis.system}
            </span>
          </div>
          <p className="mt-1 text-sm text-on-surface">{diagnosis.description}</p>
          {Object.keys(diagnosis.variables).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(diagnosis.variables).map(([key, val]) => (
                <span
                  key={key}
                  className="rounded-md bg-surface-low px-2 py-0.5 text-xs text-on-surface-variant"
                >
                  {key}: {String(val)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Status actions */}
        {diagnosis.status === 'ACTIVE' && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() =>
                statusMutation.mutate({
                  diagnosisId: diagnosis.id,
                  status: 'RESOLVED',
                  reviewerId: patientId,
                })
              }
              disabled={statusMutation.isPending}
              className="rounded-md bg-aqua-500/10 px-2 py-1 text-xs text-aqua-400 transition-colors hover:bg-aqua-500/20"
              data-testid={`diagnosis-resolve-${diagnosis.id}`}
            >
              Resolver
            </button>
            <button
              type="button"
              onClick={() =>
                statusMutation.mutate({
                  diagnosisId: diagnosis.id,
                  status: 'DISCARDED',
                  reviewerId: patientId,
                })
              }
              disabled={statusMutation.isPending}
              className="rounded-md bg-surface-low px-2 py-1 text-xs text-on-surface-variant transition-colors hover:text-on-surface"
              data-testid={`diagnosis-discard-${diagnosis.id}`}
            >
              Descartar
            </button>
          </div>
        )}
      </div>
      <div className="mt-2 text-xs text-on-surface-variant/60">
        Registrado: {new Date(diagnosis.provenance.recordedAt).toLocaleDateString('es-ES')}
        {' · '}Catálogo: {diagnosis.catalogVersion}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-outline-variant py-12 text-center">
      <p className="text-sm text-on-surface-variant">No hay diagnósticos registrados.</p>
      <p className="mt-1 text-xs text-on-surface-variant/60">
        Pulsa &quot;Nuevo diagnóstico&quot; para buscar en CIE-10-ES o SNOMED.
      </p>
    </div>
  );
}

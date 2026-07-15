'use client';

// apps/web/app/(dashboard)/imports/import-wizard.tsx
// 3-step import wizard (spec §3): upload → review mapping → resolve matches.
// Each step calls the corresponding /v1/imports endpoint via useImports hooks.
// BR-IMP-001 is enforced server-side; this UI never persists without the
// physician's explicit Confirm / Finalize actions.

import { useState } from 'react';
import {
  useParseImportFile,
  useReanalyzeImport,
  useConfirmImportMapping,
  useFinalizeImport,
  type ParseFileResponse,
  type ConfirmImportResponse,
} from '@/hooks/useImports';
import type { ColumnMapping, MatchDecision, StandardField } from '@medicore/contracts';

type Step = 'upload' | 'mapping' | 'matches';

const FIELD_OPTIONS: StandardField[] = [
  'nhc', 'patientName', 'birthDate', 'age', 'sex',
  'admissionDate', 'diagnosis', 'procedure', 'custom', 'ignore',
];

const FIELD_LABELS: Record<string, string> = {
  nhc: 'NHC',
  patientName: 'Nombre del paciente',
  birthDate: 'Fecha de nacimiento',
  age: 'Edad',
  sex: 'Sexo',
  admissionDate: 'Fecha de ingreso',
  diagnosis: 'Diagnóstico',
  procedure: 'Procedimiento',
  custom: 'Campo personalizado',
  ignore: 'Ignorar',
};

export function ImportWizard() {
  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<ParseFileResponse | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [resolutions, setResolutions] = useState<Record<string, MatchDecision>>({});
  const [confirmed, setConfirmed] = useState<ConfirmImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseMut = useParseImportFile();
  const reanalyzeMut = useReanalyzeImport();
  const confirmMut = useConfirmImportMapping();
  const finalizeMut = useFinalizeImport();

  function handleErr(e: unknown) {
    setError(e instanceof Error ? e.message : 'Error desconocido');
  }

  async function onFileSelected(file: File) {
    setError(null);
    try {
      const result = await parseMut.mutateAsync(file);
      setParsed(result);
      setMapping(result.proposal.columnMapping);
      setStep('mapping');
    } catch (e) {
      handleErr(e);
    }
  }

  async function onReanalyze() {
    if (!parsed) return;
    setError(null);
    try {
      const result = await reanalyzeMut.mutateAsync(parsed.batchId);
      setParsed({ ...parsed, proposal: result.proposal });
      setMapping(result.proposal.columnMapping);
    } catch (e) {
      handleErr(e);
    }
  }

  async function onConfirmMapping() {
    if (!parsed) return;
    setError(null);
    try {
      const result = await confirmMut.mutateAsync({
        batchId: parsed.batchId,
        columnMapping: mapping,
      });
      setConfirmed(result);
      // Default resolutions: keep the matcher's recommendation (auto/new) and
      // force the physician to decide 'confirm' ones.
      const initial: Record<string, MatchDecision> = {};
      for (const m of result.matches) {
        initial[String(m.rowIndex)] = m.decision === 'confirm' ? 'new' : m.decision;
      }
      setResolutions(initial);
      setStep('matches');
    } catch (e) {
      handleErr(e);
    }
  }

  async function onFinalize() {
    if (!parsed) return;
    setError(null);
    try {
      await finalizeMut.mutateAsync({
        batchId: parsed.batchId,
        matchResolutions: resolutions,
      });
      reset();
    } catch (e) {
      handleErr(e);
    }
  }

  function reset() {
    setStep('upload');
    setParsed(null);
    setMapping({});
    setResolutions({});
    setConfirmed(null);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <Stepper step={step} />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === 'upload' && (
        <UploadStep onFile={onFileSelected} loading={parseMut.isPending} />
      )}

      {step === 'mapping' && parsed && (
        <MappingStep
          parsed={parsed}
          mapping={mapping}
          setMapping={setMapping}
          onReanalyze={onReanalyze}
          reanalyzing={reanalyzeMut.isPending}
          onConfirm={onConfirmMapping}
          confirming={confirmMut.isPending}
          onBack={reset}
        />
      )}

      {step === 'matches' && confirmed && parsed && (
        <MatchesStep
          parsed={parsed}
          confirmed={confirmed}
          resolutions={resolutions}
          setResolutions={setResolutions}
          onFinalize={onFinalize}
          finalizing={finalizeMut.isPending}
          onBack={() => setStep('mapping')}
        />
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'upload', label: '1. Subir archivo' },
    { id: 'mapping', label: '2. Revisar mapeo' },
    { id: 'matches', label: '3. Resolver cruces' },
  ];
  return (
    <ol className="flex items-center gap-2 text-sm">
      {steps.map((s) => (
        <li
          key={s.id}
          className={
            step === s.id
              ? 'rounded-md bg-blue-600 px-3 py-1 font-medium text-white'
              : 'rounded-md bg-gray-100 px-3 py-1 text-gray-600'
          }
        >
          {s.label}
        </li>
      ))}
    </ol>
  );
}

function UploadStep({
  onFile, loading,
}: {
  onFile: (f: File) => void;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
      <p className="text-sm text-gray-600">
        Sube un archivo Excel (.xlsx/.xls), CSV o TSV del estadista del hospital. El sistema
        analiza la estructura y propone un mapeo de columnas. Nada se importa sin tu
        confirmación.
      </p>
      <input
        type="file"
        accept=".xlsx,.xls,.csv,.tsv"
        disabled={loading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
        className="mt-4 block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
      />
      {loading && <p className="mt-2 text-sm text-gray-500">Analizando…</p>}
    </div>
  );
}

function MappingStep({
  parsed, mapping, setMapping, onReanalyze, reanalyzing, onConfirm, confirming, onBack,
}: {
  parsed: ParseFileResponse;
  mapping: ColumnMapping;
  setMapping: (m: ColumnMapping) => void;
  onReanalyze: () => void;
  reanalyzing: boolean;
  onConfirm: () => void;
  confirming: boolean;
  onBack: () => void;
}) {
  const cols = parsed.sample.columns;
  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Revisar mapeo de columnas</h2>
          <p className="text-sm text-gray-600">
            {parsed.fileName} · {parsed.totalRows} filas · análisis por {parsed.provider}
          </p>
        </div>
        <button
          onClick={onReanalyze}
          disabled={reanalyzing}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {reanalyzing ? 'Re-analizando…' : 'Re-analizar con IA'}
        </button>
      </div>

      <div className="overflow-hidden rounded-md border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Columna del archivo</th>
              <th className="px-3 py-2">Campo de MediCore</th>
              <th className="px-3 py-2">Ejemplo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cols.map((col) => (
              <tr key={col}>
                <td className="px-3 py-2 font-medium text-gray-900">{col}</td>
                <td className="px-3 py-2">
                  <select
                    value={mapping[col] ?? 'ignore'}
                    onChange={(e) => setMapping({ ...mapping, [col]: e.target.value as StandardField })}
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                  >
                    {FIELD_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{FIELD_LABELS[opt]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {String(parsed.sample.rows[0]?.[col] ?? '')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          disabled={confirming}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {confirming ? 'Confirmando…' : 'Confirmar mapeo'}
        </button>
      </div>
    </div>
  );
}

function MatchesStep({
  parsed, confirmed, resolutions, setResolutions, onFinalize, finalizing, onBack,
}: {
  parsed: ParseFileResponse;
  confirmed: ConfirmImportResponse;
  resolutions: Record<string, MatchDecision>;
  setResolutions: (r: Record<string, MatchDecision>) => void;
  onFinalize: () => void;
  finalizing: boolean;
  onBack: () => void;
}) {
  void parsed;
  const pending = confirmed.matches.filter((m) => m.decision !== 'auto');

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Resolver cruces de pacientes</h2>
        <p className="text-sm text-gray-600">
          {confirmed.autoMatchCount} auto · {confirmed.pendingResolutionCount} por confirmar ·{' '}
          {confirmed.newPatientCount} nuevos
        </p>
      </div>

      {pending.length === 0 ? (
        <p className="text-sm text-gray-600">
          Todos los cruces están resueltos automáticamente. Puedes finalizar la importación.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {pending.map((m) => (
            <li key={m.rowIndex} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">Fila {m.rowIndex}</p>
                <p className="text-xs text-gray-500">
                  Score {m.score} · {m.reason}
                </p>
              </div>
              <select
                value={resolutions[String(m.rowIndex)] ?? 'new'}
                onChange={(e) =>
                  setResolutions({
                    ...resolutions,
                    [String(m.rowIndex)]: e.target.value as MatchDecision,
                  })
                }
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="confirm">Mismo paciente (enriquecer)</option>
                <option value="new">Crear nuevo</option>
              </select>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-between">
        <button onClick={onBack} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          Volver al mapeo
        </button>
        <button
          onClick={onFinalize}
          disabled={finalizing}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {finalizing ? 'Importando…' : 'Finalizar importación'}
        </button>
      </div>
    </div>
  );
}

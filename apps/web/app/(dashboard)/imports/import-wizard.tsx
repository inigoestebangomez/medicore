'use client';

// apps/web/app/(dashboard)/imports/import-wizard.tsx
// 3-step import wizard (spec §3): upload → review mapping → resolve matches.
// Each step calls the corresponding /v1/imports endpoint via useImports hooks.
// BR-IMP-001 is enforced server-side; this UI never persists without the
// physician's explicit Confirm / Finalize actions.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  useParseImportFile,
  useReanalyzeImport,
  useConfirmImportMapping,
  useFinalizeImport,
  type ParseFileResponse,
  type ConfirmImportResponse,
  type FinalizeImportResponse,
} from '@/hooks/useImports';
import type { ColumnMapping, MatchDecision, StandardField } from '@medicore/contracts';

type Step = 'upload' | 'mapping' | 'matches' | 'complete';

const FIELD_OPTIONS: StandardField[] = [
  'nhc', 'patientName', 'birthDate', 'age', 'sex',
  'admissionDate', 'diagnosis', 'procedure',
  'testType', 'requestDate', 'completionDate',
  'custom', 'ignore',
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
  testType: 'Prueba / Tipo de estudio',
  requestDate: 'Fecha de solicitud',
  completionDate: 'Fecha de realización',
  custom: 'Campo personalizado',
  ignore: 'Ignorar',
};

export function ImportWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<ParseFileResponse | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [resolutions, setResolutions] = useState<Record<string, MatchDecision>>({});
  const [confirmed, setConfirmed] = useState<ConfirmImportResponse | null>(null);
  const [finalizeResult, setFinalizeResult] = useState<FinalizeImportResponse | null>(null);
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
      const result = await finalizeMut.mutateAsync({
        batchId: parsed.batchId,
        matchResolutions: resolutions,
      });
      setFinalizeResult(result);
      setStep('complete');
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
    setFinalizeResult(null);
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

      {step === 'complete' && parsed && confirmed && finalizeResult && (
        <SuccessStep
          fileName={parsed.fileName}
          result={finalizeResult}
          summary={confirmed}
          onViewPatients={() => router.push('/patients')}
          onNewImport={reset}
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
    { id: 'complete', label: '✓ Completado' },
  ];
  const stepOrder: Step[] = ['upload', 'mapping', 'matches', 'complete'];
  const activeIdx = stepOrder.indexOf(step);
  return (
    <ol className="flex items-center gap-2 text-sm">
      {steps.map((s, i) => (
        <li
          key={s.id}
          className={
            i === activeIdx
              ? 'rounded-md bg-blue-600 px-3 py-1 font-medium text-white'
              : i < activeIdx
                ? 'rounded-md bg-green-100 px-3 py-1 text-green-700'
                : 'rounded-md bg-surface-container px-3 py-1 text-on-surface-variant'
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
    <div className="rounded-lg border border-dashed border-outline bg-surface-lowest p-8 text-center">
      <p className="text-sm text-on-surface-variant">
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
        className="mt-4 block w-full text-sm text-on-surface-variant file:mr-4 file:rounded-md file:border-0 file:bg-secondary-container/20 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
      />
      {loading && <p className="mt-2 text-sm text-on-surface-variant">Analizando…</p>}
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
  const previewRows = parsed.sample.rows.slice(0, 5);
  return (
    <div className="space-y-6 rounded-lg border border-outline-variant bg-surface-lowest p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Revisar mapeo de columnas</h2>
          <p className="text-sm text-on-surface-variant">
            {parsed.fileName} · {parsed.totalRows} filas · análisis por {parsed.provider}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onReanalyze}
          disabled={reanalyzing}
        >
          {reanalyzing ? 'Re-analizando…' : 'Re-analizar con IA'}
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-outline-variant">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-low text-left text-on-surface-variant">
            <tr>
              <th className="px-3 py-2">Columna del archivo</th>
              <th className="px-3 py-2">Campo de MediCore</th>
              <th className="px-3 py-2">Ejemplo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {cols.map((col) => (
              <tr key={col}>
                <td className="px-3 py-2 font-medium text-on-surface">{col}</td>
                <td className="px-3 py-2">
                  <select
                    value={mapping[col] ?? 'ignore'}
                    onChange={(e) => setMapping({ ...mapping, [col]: e.target.value as StandardField })}
                    className="rounded-md border border-outline px-2 py-1 text-sm"
                  >
                    {FIELD_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{FIELD_LABELS[opt]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-on-surface-variant">
                  {String(parsed.sample.rows[0]?.[col] ?? '')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vista previa de las primeras 5 filas del Excel para dar contexto */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-on-surface-variant">
          Vista previa del archivo (primeras {previewRows.length} filas)
        </h3>
        <div className="overflow-x-auto rounded-md border border-outline-variant">
          <table className="min-w-full text-xs">
            <thead className="bg-surface-low text-left text-on-surface-variant">
              <tr>
                <th className="sticky left-0 bg-surface-low px-2 py-1.5 font-medium">#</th>
                {cols.map((col) => (
                  <th key={col} className="whitespace-nowrap px-2 py-1.5 font-medium">
                    {col}
                    {mapping[col] && mapping[col] !== 'ignore' && (
                      <span className="ml-1 text-blue-500">→ {FIELD_LABELS[mapping[col]]}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {previewRows.map((row, i) => (
                <tr key={i} className={i === 0 ? 'bg-secondary-container/20' : ''}>
                  <td className="sticky left-0 bg-surface-lowest px-2 py-1.5 text-on-surface-variant/60">{i + 1}</td>
                  {cols.map((col) => (
                    <td key={col} className="whitespace-nowrap px-2 py-1.5 text-on-surface-variant">
                      {String(row[col] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" size="sm" onClick={onBack}>
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={onConfirm}
          disabled={confirming}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {confirming ? 'Confirmando…' : 'Confirmar mapeo'}
        </Button>
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
  const pending = confirmed.matches.filter((m) => m.decision !== 'auto');

  /** Traduce el score y reason técnico a un mensaje comprensible. */
  function scoreLabel(m: (typeof pending)[number]): { label: string; color: string } {
    if (m.score >= 90) return { label: 'Coincidencia alta', color: 'text-green-700' };
    if (m.score >= 50) return { label: 'Coincidencia parcial — revisar', color: 'text-amber-700' };
    return { label: 'Sin coincidencia', color: 'text-red-600' };
  }

  function reasonLabel(reason: string): string {
    const map: Record<string, string> = {
      'NHC exacto': 'NHC idéntico encontrado',
      'nombre completo exacto': 'Nombre y apellidos coinciden exactamente',
      'nombre parcial (apellidos)': 'Coincidencia parcial por apellidos',
      'nombre parcial (nombre)': 'Coincidencia parcial por nombre',
      'no matching candidate found': 'No se encontró ningún paciente similar',
      'score demasiado bajo': 'Puntuación insuficiente para emparejar',
    };
    return map[reason] ?? reason;
  }

  /** Busca los datos crudos de la fila en el sample del Excel. */
  function rowData(rowIndex: number): Record<string, unknown> | null {
    return parsed.sample.rows[rowIndex] ?? null;
  }

  return (
    <div className="space-y-4 rounded-lg border border-outline-variant bg-surface-lowest p-6">
      <div>
        <h2 className="text-lg font-semibold text-on-surface">Resolver cruces de pacientes</h2>
        <p className="text-sm text-on-surface-variant">
          {confirmed.autoMatchCount} automáticos · {confirmed.pendingResolutionCount} por revisar ·{' '}
          {confirmed.newPatientCount} nuevos
        </p>
      </div>

      {pending.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          Todos los cruces están resueltos. Puedes finalizar la importación.
        </p>
      ) : (
        <div className="space-y-2">
          {pending.map((m) => {
            const s = scoreLabel(m);
            const data = rowData(m.rowIndex);
            return (
              <div
                key={m.rowIndex}
                className="rounded-md border border-outline-variant bg-surface-low/50 p-3"
              >
                {/* Cabecera: score y decisión */}
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-on-surface">
                      Fila {m.rowIndex}
                    </span>
                    <span className={`ml-2 text-xs font-medium ${s.color}`}>
                      {s.label} (score {m.score})
                    </span>
                  </div>
                  <select
                    value={resolutions[String(m.rowIndex)] ?? 'new'}
                    onChange={(e) =>
                      setResolutions({
                        ...resolutions,
                        [String(m.rowIndex)]: e.target.value as MatchDecision,
                      })
                    }
                    className="rounded-md border border-outline px-2 py-1 text-sm"
                  >
                    <option value="confirm">Mismo paciente (enriquecer)</option>
                    <option value="new">Crear nuevo paciente</option>
                  </select>
                </div>

                {/* Motivo del match */}
                <p className="mb-1.5 text-xs text-on-surface-variant">
                  {reasonLabel(m.reason)}
                </p>

                {/* Datos de la fila del Excel */}
                {data && (
                  <div className="rounded border border-outline-variant bg-surface-lowest p-2">
                    <p className="mb-1 text-[10px] font-medium uppercase text-on-surface-variant/60">
                      Datos del archivo
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {Object.entries(data).map(([key, val]) => {
                        const sval = String(val ?? '—');
                        if (sval === '—' || sval === '') return null;
                        return (
                          <span key={key} className="text-on-surface-variant">
                            <span className="text-on-surface-variant/60">{key}:</span>{' '}
                            <span className="font-medium text-on-surface">{sval}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" size="sm" onClick={onBack}>
          Volver al mapeo
        </Button>
        <Button
          size="sm"
          onClick={onFinalize}
          disabled={finalizing}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {finalizing ? 'Importando…' : 'Finalizar importación'}
        </Button>
      </div>
    </div>
  );
}

function SuccessStep({
  fileName,
  result,
  summary,
  onViewPatients,
  onNewImport,
}: {
  fileName: string;
  result: FinalizeImportResponse;
  summary: ConfirmImportResponse;
  onViewPatients: () => void;
  onNewImport: () => void;
}) {
  return (
    <div className="space-y-6 rounded-lg border border-green-200 bg-green-50/50 p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-lg text-white">
          ✓
        </span>
        <div>
          <h2 className="text-lg font-semibold text-green-800">Importación completada</h2>
          <p className="text-sm text-green-700">{result.message}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-md border border-green-200 bg-white p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-on-surface-variant">Archivo</p>
          <p className="text-sm font-medium text-on-surface">{fileName}</p>
        </div>
        <div>
          <p className="text-xs text-on-surface-variant">Filas procesadas</p>
          <p className="text-sm font-medium text-on-surface">{summary.cleanedRowCount}</p>
        </div>
        <div>
          <p className="text-xs text-on-surface-variant">Nuevos pacientes</p>
          <p className="text-sm font-medium text-on-surface">{summary.newPatientCount}</p>
        </div>
        <div>
          <p className="text-xs text-on-surface-variant">Enriquecidos</p>
          <p className="text-sm font-medium text-on-surface">{summary.autoMatchCount}</p>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" size="sm" onClick={onNewImport}>
          Nueva importación
        </Button>
        <Button
          size="sm"
          onClick={onViewPatients}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Ver pacientes
        </Button>
      </div>
    </div>
  );
}

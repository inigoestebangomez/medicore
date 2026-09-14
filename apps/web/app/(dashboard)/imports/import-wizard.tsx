'use client';

// apps/web/app/(dashboard)/imports/import-wizard.tsx
// 3-step import wizard (spec §3): upload → review mapping → resolve matches.
// Each step calls the corresponding /v1/imports endpoint via useImports hooks.
// BR-IMP-001 is enforced server-side; this UI never persists without the
// physician's explicit Confirm / Finalize actions.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  useParseImportFile,
  useReanalyzeImport,
  useConfirmImportMapping,
  useFinalizeImport,
  useImportBatch,
  useImportPreview,
  type ParseFileResponse,
  type ConfirmImportResponse,
  type FinalizeImportResponse,
  type ImportPreviewResponse,
} from '@/hooks/useImports';
import type {
  CellOverrides,
  ColumnMapping,
  IgnoredColumn,
  MatchDecision,
  PreviewOverrides,
  IgnoredRow,
  MatchResolution,
  StandardField,
} from '@medicore/contracts';
import { validateColumnMapping } from '@medicore/contracts';

type Step = 'upload' | 'mapping' | 'matches' | 'processing' | 'complete';

const FIELD_OPTIONS: StandardField[] = [
  'nhc',
  'patientName',
  'birthDate',
  'age',
  'sex',
  'phone',
  'email',
  'idDocument',
  'idDocType',
  'address',
  'bloodType',
  'emergencyContactName',
  'emergencyContactPhone',
  'emergencyContactRelationship',
  'notes',
  'admissionDate',
  'consultationDate',
  'diagnosis',
  'diagnosisCodes',
  'procedure',
  'chiefComplaint',
  'currentIllness',
  'physicalExam',
  'assessment',
  'plan',
  'followUpDate',
  'followUpNotes',
  'surgeryDate',
  'testType',
  'requestDate',
  'completionDate',
  'hospitalStayDays',
  'surgeryDurationMinutes',
  'consultationType',
  'surgeryStatus',
  'asa',
  'anesthesiaType',
  'technique',
  'findings',
  'complications',
  'postOpNotes',
  'outcome',
  'custom',
  'ignore',
];

const FIELD_LABELS: Record<string, string> = {
  nhc: 'NHC',
  patientName: 'Nombre del paciente',
  birthDate: 'Fecha de nacimiento',
  age: 'Edad',
  sex: 'Sexo',
  phone: 'Teléfono',
  email: 'Email',
  idDocument: 'Documento de identidad',
  idDocType: 'Tipo de documento',
  address: 'Dirección',
  bloodType: 'Grupo sanguíneo',
  emergencyContactName: 'Contacto de emergencia',
  emergencyContactPhone: 'Teléfono de emergencia',
  emergencyContactRelationship: 'Relación del contacto',
  notes: 'Notas',
  admissionDate: 'Fecha de ingreso',
  consultationDate: 'Fecha de consulta',
  diagnosis: 'Diagnóstico',
  diagnosisCodes: 'Códigos diagnósticos',
  procedure: 'Procedimiento',
  chiefComplaint: 'Motivo de consulta',
  currentIllness: 'Enfermedad actual',
  physicalExam: 'Exploración física',
  assessment: 'Valoración',
  plan: 'Plan',
  followUpDate: 'Fecha de seguimiento',
  followUpNotes: 'Notas de seguimiento',
  surgeryDate: 'Fecha de cirugía',
  testType: 'Prueba / Tipo de estudio',
  requestDate: 'Fecha de solicitud',
  completionDate: 'Fecha de realización',
  hospitalStayDays: 'Tiempo de hospitalización (días)',
  surgeryDurationMinutes: 'Tiempo quirúrgico (minutos)',
  custom: 'Campo personalizado',
  consultationType: 'Tipo de consulta',
  surgeryStatus: 'Estado de cirugía',
  asa: 'Clasificación ASA',
  anesthesiaType: 'Tipo de anestesia',
  technique: 'Técnica quirúrgica',
  findings: 'Hallazgos',
  complications: 'Complicaciones',
  postOpNotes: 'Notas postoperatorias',
  outcome: 'Resultado',
  ignore: 'Ignorar',
};

const DATE_FIELDS = new Set<StandardField>([
  'birthDate',
  'admissionDate',
  'consultationDate',
  'surgeryDate',
  'requestDate',
  'completionDate',
]);
const NUMERIC_FIELDS = new Set<StandardField>(['hospitalStayDays', 'surgeryDurationMinutes']);
const EXCEL_SERIAL_MIN = 59;
const EXCEL_SERIAL_MAX = 80000;
const EXCEL_SERIAL_EPOCH_OFFSET = 25569;
const MILLISECONDS_PER_DAY = 86400 * 1000;

function expandPreviewTwoDigitYear(year: number): number {
  return year <= 49 ? 2000 + year : 1900 + year;
}

function previewCalendarDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? date
    : null;
}

function parseImportPreviewDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const serial =
    typeof value === 'number'
      ? Number.isFinite(value)
        ? value
        : null
      : typeof value === 'string' && /^\d{2,5}(?:\.\d+)?$/.test(value.trim())
        ? Number(value.trim())
        : null;
  if (serial !== null) {
    if (serial === 60 || serial < EXCEL_SERIAL_MIN || serial > EXCEL_SERIAL_MAX) return null;
    const date = new Date((serial - EXCEL_SERIAL_EPOCH_OFFSET) * MILLISECONDS_PER_DAY);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const dayFirst = trimmed.match(/^(\d{1,2})([/.\-])(\d{1,2})\2(\d{2}|\d{4})$/);
  if (dayFirst) {
    const year = dayFirst[4].length === 2
      ? expandPreviewTwoDigitYear(Number(dayFirst[4]))
      : Number(dayFirst[4]);
    return previewCalendarDate(year, Number(dayFirst[3]), Number(dayFirst[1]));
  }

  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);
  return iso
    ? previewCalendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))
    : null;
}

/** Formats explicit dates only in columns mapped to a date field. */
export function formatImportPreviewValue(value: unknown, field?: StandardField): string {
  if (value == null) return '';
  if (NUMERIC_FIELDS.has(field ?? 'ignore')) return String(value);
  if (!DATE_FIELDS.has(field ?? 'ignore')) return String(value);
  const date = parseImportPreviewDate(value);
  return date
    ? `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCFullYear()).padStart(4, '0')}`
    : String(value);
}

export function ImportWizard({
  resumeBatchId = null,
  onResetResume,
}: {
  resumeBatchId?: string | null;
  onResetResume?: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<ParseFileResponse | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [resolutions, setResolutions] = useState<Record<string, MatchDecision>>({});
  const [confirmed, setConfirmed] = useState<ConfirmImportResponse | null>(null);
  const [previewOverrides, setPreviewOverrides] = useState<PreviewOverrides>({});
  const [ignoredColumns, setIgnoredColumns] = useState<IgnoredColumn[]>([]);
  const [ignoredRows, setIgnoredRows] = useState<IgnoredRow[]>([]);
  const [cellOverrides, setCellOverrides] = useState<CellOverrides>({});
  const [finalizeResult, setFinalizeResult] = useState<FinalizeImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const initializedResumeId = useRef<string | null>(null);

  const parseMut = useParseImportFile();
  const reanalyzeMut = useReanalyzeImport();
  const confirmMut = useConfirmImportMapping();
  const finalizeMut = useFinalizeImport();
  const activeBatchId = resumeBatchId ?? finalizeResult?.batchId ?? null;
  const importDetail = useImportBatch(activeBatchId);
  const previewQuery = useImportPreview(parsed?.batchId ?? null, previewPage, 50);

  useEffect(() => {
    if (resumeBatchId && importDetail.isError) {
      setError('No se pudo reabrir esta importación. Vuelve a subir el archivo para continuar.');
      return;
    }
    const detail = importDetail.data;
    if (!resumeBatchId || !detail || initializedResumeId.current === resumeBatchId) return;
    initializedResumeId.current = resumeBatchId;
    if (detail.status !== 'CONFIRMING') {
      setError('Solo se pueden continuar importaciones pendientes de confirmación.');
      return;
    }
    setParsed({
      batchId: detail.id,
      fileName: detail.fileName,
      originalFormat: detail.originalFormat as ParseFileResponse['originalFormat'],
      totalRows: detail.totalRows,
      fileHash: '',
      sample: detail.sample,
      proposal: {
        columnMapping: detail.columnMapping,
        customFieldNames: detail.customFieldNames ?? {},
        junkRowIndices: detail.junkRowIndices ?? [],
        issues: detail.issues ?? [],
        confidence: detail.aiConfidence ?? 0,
        notes: detail.notes ?? '',
        provider: detail.aiProvider as 'heuristic' | 'groq' | 'claude' | undefined,
      },
      provider: detail.aiProvider ?? 'persisted',
    });
    setMapping(detail.columnMapping);
    setPreviewOverrides(detail.previewOverrides ?? {});
    setIgnoredColumns(detail.ignoredColumns ?? []);
    setIgnoredRows(detail.ignoredRows ?? []);
    setCellOverrides(detail.cellOverrides ?? {});
    setPreviewPage(1);
    setStep('mapping');
    setError(null);
  }, [importDetail.data, importDetail.isError, resumeBatchId]);

  useEffect(() => {
    if (step !== 'processing' || !importDetail.data) return;
    if (importDetail.data.status === 'FAILED') {
      setError(importDetail.data.errorMessage ?? 'La importación ha fallado. Revisa las coincidencias e inténtalo de nuevo.');
      setStep('matches');
    } else if (importDetail.data.status === 'COMPLETED') {
      setError(null);
      setStep('complete');
    }
  }, [importDetail.data, step]);

  function handleErr(e: unknown) {
    setError(e instanceof Error ? e.message : 'Error desconocido');
  }

  async function onFileSelected(file: File) {
    setError(null);
    try {
      const result = await parseMut.mutateAsync(file);
      setParsed(result);
      setMapping(result.proposal.columnMapping);
      setIgnoredRows([]);
      setPreviewPage(1);
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
        previewOverrides,
        ignoredColumns,
        ignoredRows,
        cellOverrides,
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
    if (!parsed || !confirmed) return;
    setError(null);
    // Disable the previous terminal detail while the explicit retry is sent.
    // No automatic retry is performed, avoiding duplicate-prone submissions.
    setFinalizeResult(null);
    try {
      const matchesByRow = new Map(confirmed.matches.map((match) => [String(match.rowIndex), match]));
      const candidateAwareResolutions: Record<string, MatchResolution> = Object.fromEntries(
        Object.entries(resolutions).map(([rowIndex, decision]) => {
          const match = matchesByRow.get(rowIndex);
          return decision === 'new'
            ? [rowIndex, decision]
            : [rowIndex, { decision, candidateId: match?.candidateId ?? null }];
        }),
      );
      const result = await finalizeMut.mutateAsync({
        batchId: parsed.batchId,
        matchResolutions: candidateAwareResolutions,
      });
      setFinalizeResult(result);
      setStep('processing');
    } catch (e) {
      handleErr(e);
    }
  }

  function reset() {
    onResetResume?.();
    setStep('upload');
    setParsed(null);
    setMapping({});
    setResolutions({});
    setConfirmed(null);
    setPreviewOverrides({});
    setIgnoredColumns([]);
    setIgnoredRows([]);
    setCellOverrides({});
    setPreviewPage(1);
    setFinalizeResult(null);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <Stepper step={step} />

      {error && (
        <div className="rounded-md border border-error/30 bg-error-container p-3 text-sm text-error">
          {error}
        </div>
      )}

      {step === 'upload' && <UploadStep onFile={onFileSelected} loading={parseMut.isPending} />}

      {step === 'mapping' && parsed && (
        <MappingStep
          parsed={parsed}
          mapping={mapping}
          setMapping={setMapping}
          previewOverrides={previewOverrides}
          setPreviewOverrides={setPreviewOverrides}
           ignoredColumns={ignoredColumns}
           setIgnoredColumns={setIgnoredColumns}
           ignoredRows={ignoredRows}
           setIgnoredRows={setIgnoredRows}
           cellOverrides={cellOverrides}
          setCellOverrides={setCellOverrides}
          onReanalyze={onReanalyze}
          reanalyzing={reanalyzeMut.isPending}
          onConfirm={onConfirmMapping}
          confirming={confirmMut.isPending}
           onBack={reset}
           preview={previewQuery.data}
           previewLoading={previewQuery.isPending}
           previewError={previewQuery.error}
           previewPage={previewPage}
           onPreviewPageChange={setPreviewPage}
        />
      )}

      {step === 'matches' && confirmed && parsed && (
         <MatchesStep
           parsed={parsed}
           confirmed={confirmed}
           mapping={mapping}
           previewOverrides={previewOverrides}
           ignoredColumns={ignoredColumns}
           ignoredRows={ignoredRows}
           cellOverrides={cellOverrides}
           resolutions={resolutions}
          setResolutions={setResolutions}
          onFinalize={onFinalize}
          finalizing={finalizeMut.isPending}
          onBack={() => setStep('mapping')}
        />
      )}

      {step === 'processing' && parsed && finalizeResult && (
        <ProcessingStep fileName={parsed.fileName} status={importDetail.data?.status ?? finalizeResult.status} />
      )}

      {step === 'complete' && parsed && confirmed && finalizeResult && importDetail.data?.status === 'COMPLETED' && (
        <SuccessStep
          fileName={parsed.fileName}
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
    { id: 'processing', label: '4. Procesando' },
    { id: 'complete', label: '✓ Completado' },
  ];
  const stepOrder: Step[] = ['upload', 'mapping', 'matches', 'processing', 'complete'];
  const activeIdx = stepOrder.indexOf(step);
  return (
    <ol className="flex items-center gap-2 text-sm">
      {steps.map((s, i) => (
        <li
          key={s.id}
          className={
            i === activeIdx
              ? 'rounded-md bg-primary px-3 py-1 font-medium text-primary-on'
              : i < activeIdx
                ? 'rounded-md bg-clinical-success/15 px-3 py-1 text-clinical-success'
                : 'rounded-md bg-surface-container px-3 py-1 text-on-surface-variant'
          }
        >
          {s.label}
        </li>
      ))}
    </ol>
  );
}

function UploadStep({ onFile, loading }: { onFile: (f: File) => void; loading: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-outline bg-surface-lowest p-8 text-center">
      <p className="text-sm text-on-surface-variant">
        Sube un archivo Excel (.xlsx/.xls), CSV o TSV del estadista del hospital. El sistema analiza
        la estructura y propone un mapeo de columnas. Nada se importa sin tu confirmación.
      </p>
      <input
        type="file"
        accept=".xlsx,.xls,.csv,.tsv"
        disabled={loading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
        className="mt-4 block w-full text-sm text-on-surface-variant file:mr-4 file:rounded-md file:border-0 file:bg-secondary-container/20 file:px-4 file:py-2 file:text-sm file:font-medium file:text-secondary hover:file:bg-secondary-container"
      />
      {loading && <p className="mt-2 text-sm text-on-surface-variant">Analizando…</p>}
    </div>
  );
}

function MappingStep({
  parsed,
  mapping,
  setMapping,
  previewOverrides,
  setPreviewOverrides,
  ignoredColumns,
  setIgnoredColumns,
  ignoredRows,
  setIgnoredRows,
  cellOverrides,
  setCellOverrides,
  onReanalyze,
  reanalyzing,
  onConfirm,
  confirming,
  onBack,
  preview,
  previewLoading,
  previewError,
  previewPage,
  onPreviewPageChange,
}: {
  parsed: ParseFileResponse;
  mapping: ColumnMapping;
  setMapping: (m: ColumnMapping) => void;
  previewOverrides: PreviewOverrides;
  setPreviewOverrides: (overrides: PreviewOverrides) => void;
  ignoredColumns: IgnoredColumn[];
  setIgnoredColumns: (columns: IgnoredColumn[]) => void;
  ignoredRows: IgnoredRow[];
  setIgnoredRows: (rows: IgnoredRow[]) => void;
  cellOverrides: CellOverrides;
  setCellOverrides: (overrides: CellOverrides) => void;
  onReanalyze: () => void;
  reanalyzing: boolean;
  onConfirm: () => void;
  confirming: boolean;
  onBack: () => void;
  preview?: ImportPreviewResponse;
  previewLoading: boolean;
  previewError: Error | null;
  previewPage: number;
  onPreviewPageChange: (page: number) => void;
}) {
  const cols = parsed.sample.columns;
  const previewRows = preview?.rows ?? parsed.sample.rows.map((values, rowIndex) => ({ rowIndex, values }));
  const totalPreviewRows = preview?.totalRows ?? parsed.totalRows;
  const previewPageSize = preview?.pageSize ?? 50;
  const totalPreviewPages = Math.max(1, Math.ceil(totalPreviewRows / previewPageSize));
  const ignored = new Set(ignoredColumns.map((item) => item.column));
  const mappingConflicts = validateColumnMapping(mapping).conflicts;
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});

  function isDateValue(value: string): boolean {
    if (!value.trim()) return true;
    return parseImportPreviewDate(value) !== null;
  }

  function updateCell(rowIndex: number, column: string, value: string) {
    const field = mapping[column];
    if (
      DATE_FIELDS.has(field) &&
      !isDateValue(value)
    ) {
      setCellErrors({ ...cellErrors, [`${rowIndex}:${column}`]: 'Introduce una fecha válida' });
      return;
    }
    const key = `${rowIndex}:${column}`;
    if (cellErrors[key]) {
      const nextErrors = { ...cellErrors };
      delete nextErrors[key];
      setCellErrors(nextErrors);
    }
    setPreviewOverrides({
      ...previewOverrides,
      [String(rowIndex)]: { ...previewOverrides[String(rowIndex)], [column]: value },
    });
  }

  function toggleCellDiscard(rowIndex: number, column: string) {
    const rowKey = String(rowIndex);
    const next = { ...cellOverrides };
    const current = { ...(next[rowKey] ?? {}) };
    if (Object.prototype.hasOwnProperty.call(current, column)) {
      delete current[column];
    } else {
      current[column] = null;
      const previewRow = { ...(previewOverrides[rowKey] ?? {}) };
      delete previewRow[column];
      const nextPreview = { ...previewOverrides };
      if (Object.keys(previewRow).length) nextPreview[rowKey] = previewRow;
      else delete nextPreview[rowKey];
      setPreviewOverrides(nextPreview);
    }
    if (Object.keys(current).length) next[rowKey] = current;
    else delete next[rowKey];
    setCellOverrides(next);
  }

  function toggleColumnDiscard(column: string) {
    if (ignored.has(column)) {
      setIgnoredColumns(ignoredColumns.filter((item) => item.column !== column));
    } else {
      setIgnoredColumns([...ignoredColumns, { column, reason: '' }]);
    }
  }

  function toggleRowDiscard(rowIndex: number) {
    const current = ignoredRows.find((item) => item.rowIndex === rowIndex);
    setIgnoredRows(
      current
        ? ignoredRows.filter((item) => item.rowIndex !== rowIndex)
        : [...ignoredRows, { rowIndex, reason: '' }],
    );
  }

  function updateRowReason(rowIndex: number, reason: string) {
    setIgnoredRows(ignoredRows.map((item) => (item.rowIndex === rowIndex ? { ...item, reason } : item)));
  }

  function updateColumnReason(column: string, reason: string) {
    setIgnoredColumns(
      ignoredColumns.map((item) => (item.column === column ? { ...item, reason } : item)),
    );
  }

  function valueFor(rowIndex: number, column: string, raw: unknown): string {
    if (Object.prototype.hasOwnProperty.call(cellOverrides[String(rowIndex)] ?? {}, column))
      return '';
    if (Object.prototype.hasOwnProperty.call(previewOverrides[String(rowIndex)] ?? {}, column)) {
      return String(previewOverrides[String(rowIndex)]?.[column] ?? '');
    }
    return formatImportPreviewValue(raw, mapping[column]);
  }

  return (
    <div className="space-y-6 rounded-lg border border-outline-variant bg-surface-lowest p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Revisar mapeo de columnas</h2>
          <p className="text-sm text-on-surface-variant">
            {parsed.fileName} · {parsed.totalRows} filas · análisis por {parsed.provider}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onReanalyze} disabled={reanalyzing}>
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
              <th className="px-3 py-2">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {cols.map((col) => (
              <tr key={col}>
                 <td className="px-3 py-2 font-medium text-on-surface">
                   <div>{col}</div>
                   <div className="mt-0.5 text-xs font-normal text-on-surface-variant">Columna {cols.indexOf(col) + 1}</div>
                 </td>
                <td className="px-3 py-2">
                  <select
                    value={mapping[col] ?? 'ignore'}
                    onChange={(e) =>
                      setMapping({ ...mapping, [col]: e.target.value as StandardField })
                    }
                    className="rounded-md border border-outline bg-surface-lowest px-2 py-1 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-focus focus:outline-none focus:ring-2 focus:ring-secondary/30"
                  >
                    {FIELD_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {FIELD_LABELS[opt]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-on-surface-variant">
                   {valueFor(0, col, parsed.sample.rows[0]?.[col])}
                </td>
                <td className="px-3 py-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleColumnDiscard(col)}
                    className={
                      ignored.has(col) ? 'border-error text-error hover:bg-error-container' : ''
                    }
                  >
                    {ignored.has(col) ? 'Restaurar' : 'Descartar columna'}
                  </Button>
                  {ignored.has(col) && (
                    <input
                      value={ignoredColumns.find((item) => item.column === col)?.reason ?? ''}
                      onChange={(event) => updateColumnReason(col, event.target.value)}
                      placeholder="Motivo opcional"
                      className="mt-1 w-full rounded border border-outline bg-surface-lowest px-2 py-1 text-xs text-on-surface placeholder:text-on-surface-variant focus:border-focus focus:outline-none focus:ring-2 focus:ring-secondary/30"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mappingConflicts.length > 0 && (
        <div role="alert" className="rounded-md border border-clinical-warning/40 bg-clinical-warning/10 p-3 text-sm text-clinical-warning">
          <p className="font-medium">Resuelve los conflictos del mapeo antes de continuar.</p>
          {mappingConflicts.map((conflict) => (
            <p key={conflict.field} className="mt-1">{conflict.message}</p>
          ))}
          <p className="mt-1">Puedes cambiar las columnas adicionales a Campo personalizado o Ignorar.</p>
        </div>
      )}

      {/* La muestra contiene como máximo 20 filas y todas deben poder corregirse. */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-on-surface-variant">
           Vista previa editable del archivo ({totalPreviewRows} filas · página {previewPage} de {totalPreviewPages})
         </h3>
         {previewError && (
           <p className="mb-2 rounded-md border border-error/30 bg-error-container p-3 text-sm text-error">
             No se pudo recuperar el contenido completo de esta importación. Vuelve a subir el archivo para continuar.
           </p>
         )}
         <div className="mb-2 flex items-center justify-between gap-2 text-xs text-on-surface-variant">
           <span>{previewLoading ? 'Cargando página…' : `Filas ${previewRows.length ? previewRows[0].rowIndex + 1 : 0}–${previewRows.length ? previewRows[previewRows.length - 1].rowIndex + 1 : 0}`}</span>
           <div className="flex gap-2">
             <Button type="button" variant="outline" size="sm" disabled={previewPage <= 1 || previewLoading} onClick={() => onPreviewPageChange(previewPage - 1)}>
               Página anterior
             </Button>
             <Button type="button" variant="outline" size="sm" disabled={previewPage >= totalPreviewPages || previewLoading} onClick={() => onPreviewPageChange(previewPage + 1)}>
               Página siguiente
             </Button>
           </div>
         </div>
         <div className="max-h-[32rem] overflow-auto rounded-md border border-outline-variant">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 z-10 bg-surface-low text-left text-on-surface-variant">
              <tr>
                <th className="sticky left-0 bg-surface-low px-2 py-1.5 font-medium">#</th>
                <th className="bg-surface-low px-2 py-1.5 font-medium">Acción fila</th>
                 {cols.map((col) => (
                   <th key={col} className="whitespace-nowrap px-2 py-1.5 font-medium">
                     <div>{col}</div>
                     {mapping[col] && mapping[col] !== 'ignore' && (
                       <div className="text-primary">{FIELD_LABELS[mapping[col]]}</div>
                     )}
                     <div className="mt-0.5 text-[10px] font-normal text-on-surface-variant/70">
                       Columna {cols.indexOf(col) + 1}
                     </div>
                   </th>
                 ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {previewRows.map(({ rowIndex, values }) => {
                const discarded = ignoredRows.find((item) => item.rowIndex === rowIndex);
                return (
                <tr key={rowIndex} className={discarded ? 'bg-error-container/30' : rowIndex === 0 ? 'bg-secondary-container/20' : ''}>
                  <td className="sticky left-0 bg-surface-lowest px-2 py-1.5 text-on-surface-variant/60">
                    Fila {rowIndex + 1}
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <Button type="button" variant="outline" size="sm" onClick={() => toggleRowDiscard(rowIndex)} className={discarded ? 'border-error text-error hover:bg-error-container' : ''}>
                      {discarded ? 'Restaurar fila' : 'Descartar fila'}
                    </Button>
                    {discarded && (
                      <input
                        aria-label={`Motivo fila ${rowIndex + 1}`}
                        value={discarded.reason ?? ''}
                        onChange={(event) => updateRowReason(rowIndex, event.target.value)}
                        placeholder="Motivo opcional"
                        className="mt-1 w-36 rounded border border-outline bg-surface-lowest px-1.5 py-1 text-[10px] text-on-surface placeholder:text-on-surface-variant focus:border-focus focus:outline-none focus:ring-2 focus:ring-secondary/30"
                      />
                    )}
                  </td>
                  {cols.map((col) => (
                    <td key={col} className="whitespace-nowrap px-2 py-1.5 text-on-surface-variant">
                      <div className="flex items-start gap-1">
                        <input
                          aria-label={`Fila ${rowIndex + 1}, ${col}`}
                          value={valueFor(rowIndex, col, values[col])}
                          disabled={ignored.has(col)}
                          onChange={(event) => updateCell(rowIndex, col, event.target.value)}
                          className="min-w-24 rounded border border-outline bg-surface-lowest px-1.5 py-1 text-xs text-on-surface placeholder:text-on-surface-variant focus:border-focus focus:outline-none focus:ring-2 focus:ring-secondary/30 disabled:opacity-50"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Descartar Fila ${rowIndex + 1}, ${col}`}
                          disabled={ignored.has(col)}
                          onClick={() => toggleCellDiscard(rowIndex, col)}
                          className={
                            Object.prototype.hasOwnProperty.call(
                              cellOverrides[String(rowIndex)] ?? {},
                              col,
                            )
                              ? 'border-error text-error hover:bg-error-container'
                              : ''
                          }
                        >
                          {Object.prototype.hasOwnProperty.call(cellOverrides[String(rowIndex)] ?? {}, col)
                            ? '↺'
                            : '×'}
                        </Button>
                      </div>
                      {cellErrors[`${rowIndex}:${col}`] && (
                        <p className="mt-1 text-[10px] text-error">
                          {cellErrors[`${rowIndex}:${col}`]}
                        </p>
                      )}
                    </td>
                  ))}
                </tr>
                );
              })}
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
            disabled={confirming || Boolean(previewError) || mappingConflicts.length > 0}
            className="bg-primary text-primary-on hover:bg-primary/90"
          >
          {confirming
            ? 'Confirmando…'
            : mappingConflicts.length > 0
              ? 'Resuelve los conflictos'
              : 'Confirmar mapeo'}
        </Button>
      </div>
    </div>
  );
}

function MatchesStep({
  parsed,
  confirmed,
  mapping,
  previewOverrides,
  ignoredColumns,
  ignoredRows,
  cellOverrides,
  resolutions,
  setResolutions,
  onFinalize,
  finalizing,
  onBack,
}: {
  parsed: ParseFileResponse;
  confirmed: ConfirmImportResponse;
  mapping: ColumnMapping;
  previewOverrides: PreviewOverrides;
  ignoredColumns: IgnoredColumn[];
  ignoredRows: IgnoredRow[];
  cellOverrides: CellOverrides;
  resolutions: Record<string, MatchDecision>;
  setResolutions: (r: Record<string, MatchDecision>) => void;
  onFinalize: () => void;
  finalizing: boolean;
  onBack: () => void;
}) {
  const [activeBucket, setActiveBucket] = useState<'full' | 'light' | 'unidentifiable'>('full');
  const [resolverPage, setResolverPage] = useState(1);
  const [selectedRowIndexes, setSelectedRowIndexes] = useState<Set<number>>(new Set());
  const resolverPreview = useImportPreview(parsed.batchId, resolverPage, 50);
  const resolverPreviewRows = resolverPreview.data?.rows ?? [];
  const resolverPreviewByIndex = new Map(resolverPreviewRows.map((row) => [row.rowIndex, row.values]));
  const resolverTotalPages = Math.max(1, Math.ceil(parsed.totalRows / 50));
  const bucketRows =
    activeBucket === 'full'
      ? confirmed.fullIdentityRows
      : activeBucket === 'light'
        ? confirmed.identityLightRows
        : confirmed.unidentifiableRows;
  const bucketIndexes = new Set(bucketRows.map((row) => row.rowIndex));
  const pending = confirmed.matches.filter(
    (m) => m.decision !== 'auto' && bucketIndexes.has(m.rowIndex),
  );
  const visibleBucketRows = bucketRows.filter(
    (row) => row.rowIndex >= (resolverPage - 1) * 50 && row.rowIndex < resolverPage * 50,
  );
  const visiblePending = pending.filter(
    (match) => match.rowIndex >= (resolverPage - 1) * 50 && match.rowIndex < resolverPage * 50,
  );
  const hasUnidentifiable = confirmed.unidentifiableRows.length > 0;
  const unidentifiableIndexes = new Set(confirmed.unidentifiableRows.map((row) => row.rowIndex));
  const eligibleRowIndexes = new Set(
    confirmed.matches
      .filter((m) => m.decision !== 'auto' && !unidentifiableIndexes.has(m.rowIndex))
      .map((m) => m.rowIndex),
  );
  const visibleRowIndexes = visiblePending.map((m) => m.rowIndex);
  const allVisibleSelected =
    visibleRowIndexes.length > 0 && visibleRowIndexes.every((rowIndex) => selectedRowIndexes.has(rowIndex));

  useEffect(() => {
    setSelectedRowIndexes((current) => {
      const next = new Set([...current].filter((rowIndex) => eligibleRowIndexes.has(rowIndex)));
      return next.size === current.size ? current : next;
    });
  }, [confirmed.matches, confirmed.unidentifiableRows]);

  /** Traduce el score y reason técnico a un mensaje comprensible. */
  function scoreLabel(m: (typeof pending)[number]): { label: string; color: string } {
    if (m.score >= 90) return { label: 'Coincidencia alta', color: 'text-clinical-success' };
    if (m.score >= 50)
      return { label: 'Coincidencia parcial — revisar', color: 'text-clinical-warning' };
    return { label: 'Sin coincidencia', color: 'text-clinical-critical' };
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

  /** Returns only values still effective after the mapping-screen edits. */
  function rowData(rowIndex: number): Array<{ key: string; label: string; value: string }> {
    const rawRow = resolverPreviewByIndex.get(rowIndex) ?? parsed.sample.rows[rowIndex];
    if (!rawRow || ignoredRows.some((row) => row.rowIndex === rowIndex)) return [];
    const ignored = new Set(ignoredColumns.map((item) => item.column));
    const preview = previewOverrides[String(rowIndex)] ?? {};
    const cells = cellOverrides[String(rowIndex)] ?? {};

    return parsed.sample.columns.flatMap((column, columnIndex) => {
      if (ignored.has(column) || mapping[column] === 'ignore' || Object.prototype.hasOwnProperty.call(cells, column)) {
        return [];
      }
      const value = Object.prototype.hasOwnProperty.call(preview, column)
        ? preview[column]
        : rawRow[column];
      const text = Object.prototype.hasOwnProperty.call(preview, column)
        ? String(value ?? '')
        : formatImportPreviewValue(value, mapping[column]);
      return text.trim()
        ? [{ key: column, label: `Columna ${columnIndex + 1} · ${column}`, value: text }]
        : [];
    });
  }

  function selectVisibleRows() {
    setSelectedRowIndexes((current) => new Set([...current, ...visibleRowIndexes]));
  }

  function clearSelection() {
    setSelectedRowIndexes(new Set());
  }

  function applyBulkResolution(decision: Extract<MatchDecision, 'confirm' | 'new'>) {
    const next = { ...resolutions };
    for (const rowIndex of selectedRowIndexes) {
      if (eligibleRowIndexes.has(rowIndex)) next[String(rowIndex)] = decision;
    }
    setResolutions(next);
    clearSelection();
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

      {resolverTotalPages > 1 && (
        <div className="flex items-center justify-between gap-2 text-xs text-on-surface-variant">
          <span>
            Filas {(resolverPage - 1) * 50 + 1}–{Math.min(resolverPage * 50, parsed.totalRows)} de {parsed.totalRows}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={resolverPage <= 1 || resolverPreview.isFetching}
              onClick={() => setResolverPage((page) => page - 1)}
            >
              Página anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={resolverPage >= resolverTotalPages || resolverPreview.isFetching}
              onClick={() => setResolverPage((page) => page + 1)}
            >
              Página siguiente
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Grupos de filas">
        {(
          [
            ['full', 'Identidad completa', confirmed.fullIdentityCount],
            ['light', 'Solo NHC', confirmed.identityLightCount],
            ['unidentifiable', 'Sin identificar', confirmed.unidentifiableCount],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeBucket === id}
            onClick={() => setActiveBucket(id)}
            className={`rounded-md border px-3 py-2 text-left text-sm ${activeBucket === id ? 'border-secondary bg-secondary-container text-on-secondary-container' : 'border-outline-variant text-on-surface-variant hover:bg-surface-low'}`}
          >
            <span className="font-medium">{label}</span>
            <span className="ml-2 rounded-full bg-surface-container px-2 py-0.5 text-xs">
              {count}
            </span>
          </button>
        ))}
      </div>

       <div className="grid grid-cols-2 gap-2 rounded-md border border-outline-variant bg-surface-low p-3 text-sm sm:grid-cols-5">
        <div>
          <span className="text-on-surface-variant">Importables</span>
          <strong className="ml-2 text-on-surface">{confirmed.cleanedRowCount}</strong>
        </div>
        <div>
          <span className="text-on-surface-variant">Pendientes</span>
          <strong className="ml-2 text-clinical-warning">{confirmed.unidentifiableCount}</strong>
        </div>
        <div>
          <span className="text-on-surface-variant">Basura</span>
          <strong className="ml-2 text-on-surface">{confirmed.junkRowCount}</strong>
        </div>
         <div>
           <span className="text-on-surface-variant">Omitidas</span>
           <strong className="ml-2 text-on-surface">{confirmed.skippedRowCount}</strong>
         </div>
         <div>
           <span className="text-on-surface-variant">Descartadas</span>
           <strong className="ml-2 text-on-surface">{confirmed.discardedRowCount ?? 0}</strong>
         </div>
      </div>

      {activeBucket === 'unidentifiable' && (
        <div className="rounded-md border border-clinical-warning/30 bg-clinical-warning/10 p-3 text-sm text-clinical-warning">
          Estas filas no se han eliminado. Pulsa «Volver al mapeo», busca la fila indicada y corrige
          el Nombre o el NHC en la vista previa. Después confirma de nuevo el mapeo. La finalización
          seguirá bloqueada mientras quede alguna pendiente.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-outline-variant bg-surface-low p-3">
        <span className="mr-1 text-sm text-on-surface-variant">
          {selectedRowIndexes.size} seleccionadas
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={selectVisibleRows}
          disabled={visiblePending.length === 0 || allVisibleSelected}
        >
          Seleccionar visibles
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={clearSelection}
          disabled={selectedRowIndexes.size === 0}
        >
          Limpiar selección
        </Button>
        <span className="h-5 w-px bg-outline-variant" aria-hidden="true" />
        <Button
          size="sm"
          onClick={() => applyBulkResolution('new')}
          disabled={selectedRowIndexes.size === 0}
        >
          Crear nuevos pacientes
        </Button>
        <Button
          size="sm"
          onClick={() => applyBulkResolution('confirm')}
          disabled={selectedRowIndexes.size === 0}
        >
          Mismo paciente (enriquecer)
        </Button>
      </div>

      {visibleBucketRows.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No hay filas en este grupo.</p>
      ) : activeBucket === 'unidentifiable' ? (
        <div className="space-y-2">
          {visibleBucketRows.map((row) => {
             const data = rowData(row.rowIndex);
            return (
              <div
                key={row.rowIndex}
                className="rounded-md border border-clinical-warning/30 bg-clinical-warning/10 p-3 text-sm"
              >
                <div>
                  <span className="font-medium text-on-surface">Fila {row.rowIndex + 1}</span>
                  <span className="ml-2 text-on-surface-variant">Pendiente de identificación</span>
                </div>
                 {data.length > 0 && (
                  <div className="mt-2 rounded border border-outline-variant bg-surface-lowest p-2">
                    <p className="mb-1 text-[10px] font-medium uppercase text-on-surface-variant/60">
                      Contenido disponible de la fila
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                       {data.map(({ key, label, value }) => {
                         return (
                           <span key={key} className="text-on-surface-variant">
                             <span className="text-on-surface-variant/60">{label}:</span>{' '}
                             <span className="font-medium text-on-surface">{value}</span>
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
      ) : visiblePending.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No hay cruces pendientes en este grupo.</p>
      ) : (
        <div className="space-y-2">
          {visiblePending.map((m) => {
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
                    <label className="mr-2 inline-flex items-center gap-2 text-sm text-on-surface">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar fila ${m.rowIndex + 1}`}
                        checked={selectedRowIndexes.has(m.rowIndex)}
                        onChange={(e) => {
                          setSelectedRowIndexes((current) => {
                            const next = new Set(current);
                            if (e.target.checked) next.add(m.rowIndex);
                            else next.delete(m.rowIndex);
                            return next;
                          });
                        }}
                        className="h-4 w-4 rounded border-outline accent-primary"
                      />
                    </label>
                    <span className="text-sm font-medium text-on-surface">
                      Fila {m.rowIndex + 1}
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
                    className="rounded-md border border-outline bg-surface-lowest px-2 py-1 text-sm text-on-surface focus:border-focus focus:outline-none focus:ring-2 focus:ring-secondary/30"
                  >
                    <option value="confirm">Mismo paciente (enriquecer)</option>
                    <option value="new">Crear nuevo paciente</option>
                  </select>
                </div>

                {/* Motivo del match */}
                <p className="mb-1.5 text-xs text-on-surface-variant">{reasonLabel(m.reason)}</p>

                {/* Datos de la fila del Excel */}
                 {data.length > 0 && (
                  <div className="rounded border border-outline-variant bg-surface-lowest p-2">
                    <p className="mb-1 text-[10px] font-medium uppercase text-on-surface-variant/60">
                      Datos del archivo
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                       {data.map(({ key, label, value }) => {
                         return (
                           <span key={key} className="text-on-surface-variant">
                             <span className="text-on-surface-variant/60">{label}:</span>{' '}
                             <span className="font-medium text-on-surface">{value}</span>
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
          disabled={finalizing || hasUnidentifiable}
          className="bg-clinical-success text-on-error text-white hover:bg-clinical-success/90"
        >
          {hasUnidentifiable
            ? 'Resuelve las filas pendientes'
            : finalizing
              ? 'Importando…'
              : 'Finalizar importación'}
        </Button>
      </div>
    </div>
  );
}

function SuccessStep({
  fileName,
  summary,
  onViewPatients,
  onNewImport,
}: {
  fileName: string;
  summary: ConfirmImportResponse;
  onViewPatients: () => void;
  onNewImport: () => void;
}) {
  return (
    <div className="space-y-6 rounded-lg border border-clinical-success/30 bg-clinical-success/10 p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-clinical-success text-lg text-on-error">
          ✓
        </span>
        <div>
          <h2 className="text-lg font-semibold text-clinical-success">Importación completada</h2>
          <p className="text-sm text-clinical-success">Importación finalizada correctamente.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-md border border-clinical-success/30 bg-surface-lowest p-4 sm:grid-cols-4">
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
          className="bg-primary text-primary-on hover:bg-primary/90"
        >
          Ver pacientes
        </Button>
      </div>
    </div>
  );
}

function ProcessingStep({ fileName, status }: { fileName: string; status: string }) {
  return (
    <div className="space-y-4 rounded-lg border border-secondary/30 bg-secondary-container/10 p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-lg text-on-secondary">
          …
        </span>
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Importación en proceso</h2>
          <p className="text-sm text-on-surface-variant">
            {fileName} sigue procesándose. Esta pantalla se actualizará cuando termine.
          </p>
        </div>
      </div>
      <p className="text-sm text-on-surface-variant">Estado actual: {status}</p>
    </div>
  );
}

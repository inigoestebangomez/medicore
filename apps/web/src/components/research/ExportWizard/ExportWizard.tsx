// apps/web/src/components/research/ExportWizard/ExportWizard.tsx
// Multi-step export wizard (M7):
//   Step 1 — select formats (Word, TIFF, CSV, R syntax, SPSS syntax, ZIP all)
//   Step 2 — configure (figure DPI, citation style APA/Vancouver)
//   Step 3 — download (progress, individual + ZIP download buttons)
// Gated by RESEARCH_V3_EXPORT. Preserves the existing V2 PDF/PNG export path
// (separate controller) — this component only drives V3.

'use client';

import { useState } from 'react';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import {
  useExportV3,
  getExportDownloadUrl,
  EXPORT_FORMAT_LABEL,
  type ExportFormat,
  type ExportV3Request,
} from '@/hooks/useStudiesWithBadges';

const FORMATS: ExportFormat[] = ['docx', 'tiff', 'csv', 'r_syntax', 'spss_syntax', 'zip'];

export interface ExportWizardProps {
  studyId: string;
  studyName: string;
  /** optional pre-assembled payload (table1/comparison/analyses/tests) */
  payload?: Partial<ExportV3Request>;
}

export function ExportWizard({ studyId, studyName, payload }: ExportWizardProps) {
  const enabled = useFeatureFlag('RESEARCH_V3_EXPORT');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selected, setSelected] = useState<Set<ExportFormat>>(new Set(['docx']));
  const [style, setStyle] = useState<'APA' | 'Vancouver'>('APA');
  const [dpi, setDpi] = useState(300);
  const mutation = useExportV3();
  const result = mutation.data;

  if (!enabled) {
    return <p className="text-xs text-on-surface-variant">Exportación V3 deshabilitada (RESEARCH_V3_EXPORT).</p>;
  }

  function toggleFormat(f: ExportFormat) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });
  }

  async function runExport() {
    const formats = Array.from(selected);
    await mutation.mutateAsync({
      studyName,
      formats,
      style,
      ...(payload ?? {}),
    } as ExportV3Request);
    setStep(3);
  }

  return (
    <div data-testid="export-wizard" className="space-y-6">
      {/* Stepper */}
      <ol className="flex gap-2 text-xs">
        {[1, 2, 3].map((s) => (
          <li
            key={s}
            className={`rounded-full px-3 py-1 ${step === s ? 'bg-indigo-600 text-white' : 'bg-surface-low text-on-surface-variant'}`}
            data-testid={`step-${s}`}
          >
            Paso {s}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-on-surface">1 · Formatos</h2>
          <div className="space-y-1">
            {FORMATS.map((f) => (
              <label key={f} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(f)}
                  onChange={() => toggleFormat(f)}
                  aria-label={`format ${f}`}
                />
                {EXPORT_FORMAT_LABEL[f]}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={selected.size === 0}
            className="mt-3 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary disabled:opacity-50"
          >
            Continuar
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-on-surface">2 · Configuración</h2>
          <label className="block text-xs font-semibold uppercase text-on-surface-variant">
            Estilo de citación
            <select
              aria-label="Estilo de citación"
              value={style}
              onChange={(e) => setStyle(e.target.value as 'APA' | 'Vancouver')}
              className="mt-1 w-full max-w-xs rounded border border-outline px-2 py-1 text-sm"
            >
              <option value="APA">APA</option>
              <option value="Vancouver">Vancouver</option>
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase text-on-surface-variant">
            DPI de la figura
            <input
              type="number"
              min={72}
              max={600}
              aria-label="DPI de la figura"
              value={dpi}
              onChange={(e) => setDpi(Number(e.target.value) || 300)}
              className="mt-1 w-24 rounded border border-outline px-2 py-1 text-sm"
            />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(1)} className="rounded-md border border-outline px-3 py-1.5 text-sm">
              Atrás
            </button>
            <button
              type="button"
              onClick={() => void runExport()}
              disabled={mutation.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary disabled:opacity-50"
              data-testid="run-export"
            >
              {mutation.isPending ? 'Generando…' : 'Generar exportación'}
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-3" data-testid="export-results">
          <h2 className="text-sm font-semibold text-on-surface">3 · Descarga</h2>
          {mutation.isError && <p className="text-xs text-red-600">Error en la exportación.</p>}
          {result && (
            <div className="rounded-md border border-outline p-3">
              <p className="text-sm text-on-surface">Archivo: <strong>{result.filename}</strong></p>
              <p className="text-xs text-on-surface-variant">Job: {result.jobId}</p>
              <a
                href={getExportDownloadUrl(result.jobId)}
                className="mt-2 inline-block rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary"
                data-testid="download-link"
              >
                Descargar {result.format}
              </a>
            </div>
          )}
          <button type="button" onClick={() => setStep(1)} className="rounded-md border border-outline px-3 py-1.5 text-sm">
            Exportar otro
          </button>
        </section>
      )}

      {studyId && null /* reserved for future per-study payload fetch */}
    </div>
  );
}

export default ExportWizard;
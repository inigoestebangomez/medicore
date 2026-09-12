// apps/web/app/(dashboard)/patients/[patientId]/clinical-record/complementary-tests/page.tsx
// Category: Complementary Tests (Pruebas complementarias) — spec §5.
// Lab review controls (confirm/reject OCR), imaging metadata, non-ECOG scales.

'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useLabReports, useConfirmLabResults } from '@/hooks/useClinicalRecord';
import type { LabReportResponse, LabResultItem } from '@medicore/contracts';

const REVIEW_STYLES: Record<string, { label: string; className: string }> = {
  UNREVIEWED: { label: 'Sin revisar', className: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  CONFIRMED: { label: 'Confirmado', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  REJECTED: { label: 'Rechazado', className: 'bg-rose-500/15 text-rose-400 border-rose-500/20' },
};

export default function ComplementaryTestsPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { reports, isLoading } = useLabReports(patientId);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-on-surface">Pruebas complementarias</h2>
        <p className="text-sm text-on-surface-variant">
          Resultados de laboratorio revisados, imágenes DICOM y escalas clínicas.
          Los datos OCR deben ser confirmados por un clínico antes de usarse.
        </p>
      </header>

      {/* Lab Reports Section */}
      <section className="space-y-4">
        <h3 className="text-base font-medium text-on-surface">Informes de laboratorio</h3>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-lg border border-outline-variant bg-surface-low" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-lg border border-dashed border-outline-variant py-12 text-center">
            <p className="text-sm text-on-surface-variant">No hay informes de laboratorio.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <LabReportCard key={report.id} report={report} patientId={patientId} />
            ))}
          </div>
        )}
      </section>

      {/* Imaging Section */}
      <section className="space-y-4">
        <h3 className="text-base font-medium text-on-surface">Estudios de imagen</h3>
        <div className="rounded-lg border border-dashed border-outline-variant py-8 text-center">
          <p className="text-sm text-on-surface-variant">
            Los estudios DICOM se gestionan desde la sección de Imágenes.
          </p>
        </div>
      </section>

      {/* Non-ECOG Clinical Scales */}
      <section className="space-y-4">
        <h3 className="text-base font-medium text-on-surface">Escalas clínicas</h3>
        <div className="rounded-lg border border-dashed border-outline-variant py-8 text-center">
          <p className="text-sm text-on-surface-variant">
            Las escalas clínicas (excepto ECOG) se gestionan desde la sección de Escalas.
          </p>
        </div>
      </section>
    </div>
  );
}

function LabReportCard({
  report,
  patientId,
}: {
  report: LabReportResponse;
  patientId: string;
}) {
  const confirmMutation = useConfirmLabResults(patientId);
  const [selectedResults, setSelectedResults] = useState<
    Map<number, 'CONFIRMED' | 'REJECTED'>
  >(new Map());
  const overallReview = REVIEW_STYLES[report.overallReviewState] ?? REVIEW_STYLES.UNREVIEWED;

  const toggleResult = (index: number, state: 'CONFIRMED' | 'REJECTED') => {
    setSelectedResults((prev) => {
      const next = new Map(prev);
      if (next.get(index) === state) {
        next.delete(index);
      } else {
        next.set(index, state);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    if (selectedResults.size === 0) return;
    const results = Array.from(selectedResults.entries()).map(([index, reviewState]) => ({
      index,
      reviewState,
    }));
    confirmMutation.mutate(
      {
        reportId: report.id,
        results,
        reviewerId: patientId, // In production: from auth context
      },
      {
        onSuccess: () => setSelectedResults(new Map()),
      },
    );
  };

  return (
    <div
      className="rounded-lg border border-outline-variant bg-surface-lowest p-4"
      data-testid={`lab-report-${report.id}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-on-surface">{report.fileName}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-on-surface-variant">
            <span>{new Date(report.createdAt).toLocaleDateString('es-ES')}</span>
            <span>·</span>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${overallReview.className}`}>
              {overallReview.label}
            </span>
            {report.provenance.sourceType === 'ocr' && (
              <>
                <span>·</span>
                <span className="text-amber-400">OCR — requiere revisión</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Results table */}
      {report.results.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border border-outline-variant">
          <table className="w-full text-sm">
            <thead className="bg-surface-low">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-on-surface-variant">Analito</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-on-surface-variant">Valor</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-on-surface-variant">Unidad</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-on-surface-variant">Rango</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-on-surface-variant">Estado</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-on-surface-variant">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {report.results.map((result, index) => (
                <LabResultRow
                  key={index}
                  result={result}
                  index={index}
                  selectedState={selectedResults.get(index)}
                  onToggle={toggleResult}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Review actions */}
      {selectedResults.size > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-surface-low p-3">
          <p className="text-xs text-on-surface-variant">
            {selectedResults.size} resultado(s) seleccionado(s)
          </p>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirmMutation.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
            data-testid="lab-confirm-btn"
          >
            {confirmMutation.isPending ? 'Guardando...' : 'Confirmar selección'}
          </button>
        </div>
      )}
    </div>
  );
}

function LabResultRow({
  result,
  index,
  selectedState,
  onToggle,
}: {
  result: LabResultItem;
  index: number;
  selectedState: 'CONFIRMED' | 'REJECTED' | undefined;
  onToggle: (index: number, state: 'CONFIRMED' | 'REJECTED') => void;
}) {
  const review = REVIEW_STYLES[result.reviewState] ?? REVIEW_STYLES.UNREVIEWED;

  return (
    <tr className="border-t border-outline-variant">
      <td className="px-3 py-2 text-on-surface">{result.name}</td>
      <td className="px-3 py-2 font-medium text-on-surface">{result.value}</td>
      <td className="px-3 py-2 text-on-surface-variant">{result.unit ?? '—'}</td>
      <td className="px-3 py-2 text-on-surface-variant">{result.referenceRange ?? '—'}</td>
      <td className="px-3 py-2">
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${review.className}`}>
          {review.label}
        </span>
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onToggle(index, 'CONFIRMED')}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              selectedState === 'CONFIRMED'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-on-surface-variant hover:bg-surface-low hover:text-emerald-400'
            }`}
            data-testid={`lab-result-confirm-${index}`}
          >
            ✓
          </button>
          <button
            type="button"
            onClick={() => onToggle(index, 'REJECTED')}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              selectedState === 'REJECTED'
                ? 'bg-rose-500/20 text-rose-400'
                : 'text-on-surface-variant hover:bg-surface-low hover:text-rose-400'
            }`}
            data-testid={`lab-result-reject-${index}`}
          >
            ✗
          </button>
        </div>
      </td>
    </tr>
  );
}

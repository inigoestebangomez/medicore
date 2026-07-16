'use client';

// apps/web/src/components/research/export-dialog.tsx
// Export options for a research cohort. BR-RES-002: every format is anonymized
// server-side (non-reversible subject IDs; never real names/NHC/DOB). The
// client builds the download Blob from the returned content string.

import { useState } from 'react';
import { useExport } from '@/hooks/useResearch';
import type { ExportFormat } from '@medicore/contracts';

export interface ExportDialogProps {
  queryId?: string;
  collectionId?: string;
}

const FORMATS: Array<{ value: ExportFormat; label: string; hint: string }> = [
  { value: 'csv', label: 'CSV (anónimo)', hint: 'Tabla anónima, IDs no reversibles' },
  { value: 'word_table1', label: 'Word — Tabla 1', hint: 'Resumen descriptivo para pegar en Word' },
  { value: 'png_charts', label: 'Gráficos (PNG)', hint: 'Manifest para renderizar en cliente' },
  { value: 'stats_pdf', label: 'PDF de estadística', hint: 'Manifest para renderizar en cliente' },
];

export function ExportDialog({ queryId, collectionId }: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const exportMut = useExport();

  const run = async (format: ExportFormat) => {
    const result = await exportMut.mutateAsync({ queryId, collectionId, format });
    // Download for text-like formats; manifest formats just confirm.
    if (result.content && result.mimeType !== 'application/json') {
      const blob = new Blob([result.content], { type: result.mimeType });
      triggerDownload(blob, result.filename);
    } else {
      alert(`Export "${result.format}" generado (anónimo). Revisa el manifest en el cliente.`);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
      >
        Exportar ▾
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-72 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
          <p className="mb-1 px-1 text-xs font-medium text-gray-500">
            BR-RES-002: las exportaciones siempre son anónimas.
          </p>
          {!queryId && !collectionId && (
            <p className="px-1 text-xs text-red-600">Se necesita una consulta o colección activa.</p>
          )}
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              disabled={exportMut.isPending || (!queryId && !collectionId)}
              onClick={() => { void run(f.value); setOpen(false); }}
              className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-gray-100 disabled:opacity-50"
            >
              <span className="font-medium text-gray-800">{f.label}</span>
              <span className="block text-xs text-gray-500">{f.hint}</span>
            </button>
          ))}
          {exportMut.isError && (
            <p className="mt-1 px-1 text-xs text-red-600">
              Error: {(exportMut.error as Error).message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
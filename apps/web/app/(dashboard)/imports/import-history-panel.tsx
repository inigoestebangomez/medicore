'use client';

import { useImportHistory, type ImportBatchListItem } from '@/hooks/useImports';
import type { ImportStatus } from '@medicore/contracts';

const STATUS_LABELS: Record<ImportStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMING: 'Requiere confirmación',
  PROCESSING: 'Procesando',
  COMPLETED: 'Completada',
  FAILED: 'Fallida',
};

const STATUS_CLASSES: Record<ImportStatus, string> = {
  PENDING: 'bg-surface-container text-on-surface-variant',
  CONFIRMING: 'bg-clinical-warning/15 text-clinical-warning',
  PROCESSING: 'bg-secondary-container text-on-secondary-container',
  COMPLETED: 'bg-clinical-success/15 text-clinical-success',
  FAILED: 'bg-error-container text-error',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function Counters({ item }: { item: ImportBatchListItem }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-on-surface-variant">
      <span>Total: {item.totalRows}</span>
      <span>Importadas: {item.importedRows}</span>
      <span>Enriquecidas: {item.enrichedRows}</span>
      <span>Nuevas: {item.createdRows}</span>
      <span>Omitidas automáticamente: {item.skippedRows}</span>
      <span>Descartadas: {item.discardedRowCount ?? 0}</span>
    </div>
  );
}

function HistoryItem({ item, onResume }: { item: ImportBatchListItem; onResume?: (batchId: string) => void }) {
  return (
    <li className="space-y-2 rounded-md border border-outline-variant bg-surface-lowest p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-on-surface">{item.fileName}</p>
          <p className="text-xs text-on-surface-variant">{formatDate(item.createdAt)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[item.status]}`}>
          {STATUS_LABELS[item.status]}
        </span>
      </div>
      <Counters item={item} />
      {item.errorMessage && (
        <p className="rounded-md border border-error/30 bg-error-container/50 p-2 text-sm text-error">
          {item.errorMessage}
        </p>
      )}
      {item.status === 'CONFIRMING' && onResume && (
        <button
          type="button"
          onClick={() => onResume(item.id)}
          className="rounded-md border border-secondary px-3 py-1.5 text-sm font-medium text-secondary hover:bg-secondary-container"
        >
          Continuar
        </button>
      )}
    </li>
  );
}

export function ImportHistoryPanel({ onResume }: { onResume?: (batchId: string) => void }) {
  const history = useImportHistory();

  return (
    <section className="space-y-3" aria-labelledby="import-history-title">
      <div>
        <h2 id="import-history-title" className="text-lg font-semibold text-on-surface">
          Historial de importaciones
        </h2>
        <p className="text-sm text-on-surface-variant">
          Incluye importaciones completadas, fallidas y pendientes de confirmación.
        </p>
      </div>

      {history.isPending && <p className="text-sm text-on-surface-variant">Cargando historial…</p>}
      {history.isError && (
        <p className="rounded-md border border-error/30 bg-error-container p-3 text-sm text-error">
          No se pudo cargar el historial de importaciones.
        </p>
      )}
      {history.data && history.data.items.length === 0 && (
        <p className="rounded-md border border-outline-variant bg-surface-lowest p-4 text-sm text-on-surface-variant">
          Todavía no hay importaciones registradas.
        </p>
      )}
      {history.data && history.data.items.length > 0 && (
        <ul className="space-y-2">
          {history.data.items.map((item) => <HistoryItem key={item.id} item={item} onResume={onResume} />)}
        </ul>
      )}
    </section>
  );
}

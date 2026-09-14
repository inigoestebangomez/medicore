export const IMPORT_MATERIALIZED_ACTION = 'IMPORT_MATERIALIZED';

export interface ImportMaterializedMarker {
  action: typeof IMPORT_MATERIALIZED_ACTION;
  importBatchId: string;
  importRowIndex: number;
  performedBy: string;
  performedAt: string;
  /** Raw mapped clinical values kept for audit; never projected as patient fields. */
  importedFields?: Record<string, unknown>;
}

export function importMaterializedAuditLog(marker: Omit<ImportMaterializedMarker, 'action'>): ImportMaterializedMarker[] {
  return [{ action: IMPORT_MATERIALIZED_ACTION, ...marker }];
}

export function hasImportMaterializedMarker(
  auditLog: unknown,
  batchId: string,
  rowIndex?: number,
): boolean {
  const entries = Array.isArray(auditLog)
    ? auditLog
    : auditLog && typeof auditLog === 'object' && Array.isArray((auditLog as { importAuditLog?: unknown }).importAuditLog)
      ? (auditLog as { importAuditLog: unknown[] }).importAuditLog
      : [];
  return entries.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const marker = entry as Partial<ImportMaterializedMarker>;
    return marker.action === IMPORT_MATERIALIZED_ACTION
      && marker.importBatchId === batchId
      && (rowIndex === undefined || marker.importRowIndex === rowIndex);
  });
}

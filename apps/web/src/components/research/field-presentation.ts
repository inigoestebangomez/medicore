import type { FieldCatalogEntry, FieldSourceV2, FieldType } from '@medicore/contracts';

export const STANDARD_FIELD_LABELS: Record<string, string> = {
  age: 'Edad',
  sex: 'Sexo',
  birthDate: 'Fecha de nacimiento',
  bloodType: 'Grupo sanguíneo',
  nhc: 'NHC',
  importSource: 'Fuente de importación',
  createdAt: 'Fecha de alta',
  firstName: 'Nombre',
  lastName: 'Apellidos',
};

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  string: 'texto',
  number: 'numérico',
  date: 'fecha',
  boolean: 'booleano',
};

export const FIELD_SOURCE_LABELS: Record<FieldSourceV2, string> = {
  standard: 'estándar',
  imported: 'importado',
};

export function getFieldLabel(field: string, entry?: Pick<FieldCatalogEntry, 'label'>): string {
  return entry?.label?.trim() || STANDARD_FIELD_LABELS[field] || field;
}

function formatExample(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value.length > 24 ? `${value.slice(0, 24)}…` : value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

export function formatFieldMetadata(entry: FieldCatalogEntry, totalPatients?: number): string {
  const completeness = entry.totalCount !== undefined
    ? `${entry.nonNullCount.toLocaleString()}/${entry.totalCount.toLocaleString()} (${entry.completenessPercent ?? 0}%)`
    : totalPatients && totalPatients > 0
      ? `${Math.min(100, Math.round((entry.nonNullCount / totalPatients) * 100))}% completos`
      : `${entry.nonNullCount.toLocaleString()} no nulos`;
  const unit = entry.unit ? ` · unidad: ${entry.unit}` : '';
  const examples = entry.examples.slice(0, 5).map(formatExample).join(', ') || '—';
  return `${completeness} · ${FIELD_TYPE_LABELS[entry.type]}${unit} · ejemplos: ${examples}`;
}

export function formatFieldOrigin(entry: FieldCatalogEntry): string {
  const headers = entry.originalHeaders?.filter(Boolean).slice(0, 2) ?? [];
  const batches = entry.batches?.slice(0, 2).map((batch) => `${batch.fileName} (${batch.originalFormat})`) ?? [];
  return [
    headers.length ? `Excel: ${headers.join(', ')}` : '',
    batches.length ? `Lote: ${batches.join(', ')}` : '',
  ].filter(Boolean).join(' · ');
}

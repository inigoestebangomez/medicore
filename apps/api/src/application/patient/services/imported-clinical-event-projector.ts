import type { ImportedClinicalEvent, ImportedEventsPage } from '@medicore/contracts';

const MAX_BLOCKS = 2_000;
const MAX_KEYS = 100;
const MAX_VALUE_LENGTH = 2_000;
const MAX_TOTAL_VALUE_LENGTH = 100_000;
const METADATA_KEYS = new Set(['_rowIndex', '_rowIndices', '_importedAt', '_batchName', 'importAuditLog', 'importedFields']);
const STANDARD_KEYS = new Set([
  'nhc', 'patientName', 'birthDate', 'birthDateEstimated', 'birthDateReferenceYear', 'age', 'sex', 'admissionDate', 'diagnosis',
  'phone', 'email', 'idDocument', 'idDocType', 'address', 'bloodType',
  'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship', 'notes',
  'consultationDate', 'consultationType', 'chiefComplaint', 'currentIllness', 'physicalExam', 'assessment',
  'diagnosisCodes', 'plan', 'followUpDate', 'followUpNotes', 'surgeryDate', 'procedure', 'surgeryStatus',
  'asa', 'anesthesiaType', 'surgeryDurationMinutes', 'technique', 'findings', 'complications', 'postOpNotes',
  'outcome', 'testType', 'requestDate', 'completionDate', 'hospitalStayDays',
]);
const STANDARD_FIELD_ORDER = [
  'nhc', 'patientName', 'birthDate', 'birthDateEstimated', 'birthDateReferenceYear', 'age', 'sex', 'admissionDate', 'diagnosis',
  'phone', 'email', 'idDocument', 'idDocType', 'address', 'bloodType',
  'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship', 'notes',
  'consultationDate', 'consultationType', 'chiefComplaint', 'currentIllness', 'physicalExam', 'assessment',
  'diagnosisCodes', 'plan', 'followUpDate', 'followUpNotes', 'surgeryDate', 'procedure', 'surgeryStatus',
  'asa', 'anesthesiaType', 'surgeryDurationMinutes', 'technique', 'findings', 'complications', 'postOpNotes',
  'outcome', 'testType', 'requestDate', 'completionDate', 'hospitalStayDays',
];

type Scalar = string | number | boolean | null;
type ProjectedEvent = ImportedClinicalEvent & { sortKey: string; ordinal: number };

export interface ImportedProjection {
  items: ProjectedEvent[];
  truncated: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScalar(value: unknown): value is Scalar {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function validDate(value: unknown): string | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function trustedIndices(block: Record<string, unknown>): number[] {
  const raw = Array.isArray(block._rowIndices)
    ? block._rowIndices
    : Number.isInteger(block._rowIndex) && (block._rowIndex as number) >= 0 ? [block._rowIndex] : [];
  return raw.filter((value): value is number => Number.isInteger(value) && value >= 0);
}

function orderFields(fields: Record<string, Scalar>, standard: boolean): Record<string, Scalar> {
  const ordered = Object.entries(fields).sort(([a], [b]) => {
    if (standard) return STANDARD_FIELD_ORDER.indexOf(a) - STANDARD_FIELD_ORDER.indexOf(b);
    return a.localeCompare(b, 'es');
  });
  return Object.fromEntries(ordered);
}

export class ImportedClinicalEventProjector {
  project(
    importedData: Record<string, unknown> | null,
    importSource: string | null,
  ): ImportedProjection {
    if (!isRecord(importedData)) return { items: [], truncated: false };
    const items: ProjectedEvent[] = [];
    let truncated = false;
    let scanned = 0;
    let totalValueLength = 0;

    const entries: Array<{ batchId: string | null; block: Record<string, unknown>; ordinal: number }> = [];
    for (const [batchId, candidate] of Object.entries(importedData)) {
      if (Array.isArray(candidate)) {
        candidate.forEach((item, ordinal) => {
          if (isRecord(item)) entries.push({ batchId, block: item, ordinal });
        });
      } else if (isRecord(candidate)) {
        entries.push({ batchId, block: candidate, ordinal: 0 });
      }
    }

    for (const { batchId, block, ordinal } of entries) {
      if (scanned++ >= MAX_BLOCKS) { truncated = true; break; }
      const indices = trustedIndices(block);
      const standardFields: Record<string, Scalar> = {};
      const customFields: Record<string, Scalar> = {};
      let fieldCount = 0;
      let displayable = false;

      for (const [key, value] of Object.entries(block)) {
        if (METADATA_KEYS.has(key)) continue;
        if (++fieldCount > MAX_KEYS) { truncated = true; break; }
        if (!isScalar(value)) { truncated = true; continue; }
        const valueLength = value === null ? 0 : String(value).length;
        if (valueLength > MAX_VALUE_LENGTH || totalValueLength + valueLength > MAX_TOTAL_VALUE_LENGTH) {
          truncated = true;
          continue;
        }
        totalValueLength += valueLength;
        if (value !== null && value !== '') displayable = true;
        (STANDARD_KEYS.has(key) ? standardFields : customFields)[key] = value;
      }
      if (!displayable) continue;

      const importedAt = validDate(block._importedAt);
      const clinicalDates = [
        'consultationDate', 'surgeryDate', 'admissionDate', 'requestDate', 'completionDate', 'followUpDate',
      ]
        .map((key) => validDate(block[key]))
        .filter((value): value is string => value !== null);
      const date = [...clinicalDates, ...(importedAt ? [importedAt] : [])].sort().at(-1) ?? null;
      const rowGranularity = indices.length > 1 ? 'merged-block' : indices.length === 1 ? 'single-row' : 'legacy-block';
      const firstRow = indices.length ? indices[0] : null;
      const sourceFormat = importSource === 'xlsx' || importSource === 'csv' || importSource === 'tsv' ? importSource : 'unknown';
      const id = `${batchId ?? 'legacy'}-${firstRow ?? 'block'}-${ordinal}`;
      const sortKey = `${date ? 0 : 1}|${date ?? ''}|${batchId ?? ''}|${String(firstRow ?? -1).padStart(10, '0')}|${String(ordinal).padStart(10, '0')}`;
      items.push({
        id, type: 'import', date, batchId, batchName: typeof block._batchName === 'string' ? block._batchName : null,
        rowIndex: firstRow, rowIndices: indices, rowGranularity, importedAt, sourceFormat,
        standardFields: orderFields(standardFields, true),
        customFields: orderFields(customFields, false), sortKey, ordinal,
      });
    }

    items.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    return { items, truncated };
  }

  static stripSortFields(page: ImportedProjection): ImportedEventsPage['items'] {
    return page.items.map(({ sortKey: _sortKey, ordinal: _ordinal, ...event }) => event);
  }
}

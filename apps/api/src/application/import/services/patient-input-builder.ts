// apps/api/src/application/import/services/patient-input-builder.ts
// Pure mapping from a cleaned import row to the patient fields the import
// processor persists (SDD import-data-quality). Extracted from ImportProcessor
// so the row → patient-parts transform is trivially unit-testable without the
// BullMQ / DI plumbing.
//
// Key contracts vs. the legacy processor:
//   - Patient name is NORMALIZED (title case) via the shared NameNormalizer.
//   - birthDate is `null` when absent — NEVER the synthetic 1900-01-01
//     placeholder that historically masked "unknown DOB".
//   - The extracted patient phone is assigned.

import { normalizeName, splitNormalizedName } from '@/domain/patient/name-normalizer';
import type { CleanedRow } from './data-cleaner.service';

export interface PatientInputParts {
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  phone: string | null;
}

const FALLBACK_FIRST_NAME = 'Desconocido';

export function buildPatientInputFromRow(row: CleanedRow): PatientInputParts {
  const normalized = normalizeName(row.patientName ?? '');
  const { firstName, lastName } = splitNormalizedName(normalized);
  return {
    firstName: firstName || FALLBACK_FIRST_NAME,
    lastName,
    birthDate: row.birthDate ?? null,
    phone: row.phone ?? null,
  };
}
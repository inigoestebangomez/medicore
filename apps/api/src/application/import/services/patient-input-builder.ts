// apps/api/src/application/import/services/patient-input-builder.ts
// Pure mapping from a cleaned import row to the patient fields the import
// processor persists (SDD import-data-quality). Extracted from ImportProcessor
// so the row → patient-parts transform is trivially unit-testable without the
// BullMQ / DI plumbing.
//
// Key contracts vs. the legacy processor:
//   - Patient name is NORMALIZED (title case) via the shared NameNormalizer.
//   - birthDate is `null` when absent and no stable age reference is available;
//     estimated dates are supplied by the cleaner with explicit provenance.
//   - The extracted patient phone is assigned.

import { normalizeName, splitNormalizedName } from '@/domain/patient/name-normalizer';
import type { CleanedRow } from './data-cleaner.service';

export interface PatientInputParts {
  firstName: string | null;
  lastName: string | null;
  birthDate: Date | null;
  phone: string | null;
  email: string | null;
  idDocument: string | null;
  idDocType: string | null;
  address: Record<string, unknown> | null;
  bloodType: string | null;
  emergencyContact: Record<string, unknown> | null;
  notes: string | null;
}

const FALLBACK_FIRST_NAME = 'Desconocido';
function safeBirthDate(value: Date | null): Date | null {
  return value && value.getUTCFullYear() !== 1900 ? value : null;
}

function nonEmpty(value: string | null): string | null {
  return value?.trim() || null;
}

function buildEmergencyContact(row: CleanedRow): Record<string, unknown> | null {
  const name = nonEmpty(row.emergencyContactName);
  const phone = nonEmpty(row.emergencyContactPhone);
  const relationship = nonEmpty(row.emergencyContactRelationship);
  if (!name && !phone && !relationship) return null;
  return {
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
    ...(relationship ? { relationship } : {}),
  };
}

function buildNativeParts(row: CleanedRow): Omit<PatientInputParts, 'firstName' | 'lastName' | 'birthDate'> {
  const address = nonEmpty(row.address);
  return {
    phone: nonEmpty(row.phone),
    email: nonEmpty(row.email),
    idDocument: nonEmpty(row.idDocument),
    idDocType: nonEmpty(row.idDocType),
    address: address ? { street: address } : null,
    bloodType: nonEmpty(row.bloodType),
    emergencyContact: buildEmergencyContact(row),
    notes: nonEmpty(row.notes),
  };
}

export function buildPatientInputFromRow(row: CleanedRow, identityLightEnabled = false): PatientInputParts {
  if (identityLightEnabled && !row.patientName && row.nhc) {
    return {
      firstName: null,
      lastName: null,
      birthDate: safeBirthDate(row.birthDate),
      ...buildNativeParts(row),
    };
  }

  const normalized = normalizeName(row.patientName ?? '');
  const { firstName, lastName } = splitNormalizedName(normalized);
  return {
    firstName: firstName || (identityLightEnabled ? null : FALLBACK_FIRST_NAME),
    lastName: lastName || (identityLightEnabled && !row.patientName ? null : lastName),
    birthDate: safeBirthDate(row.birthDate),
    ...buildNativeParts(row),
  };
}

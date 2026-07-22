// apps/api/src/application/import/services/patient-input-builder.spec.ts
import { describe, it, expect } from '@jest/globals';
import { buildPatientInputFromRow } from './patient-input-builder';
import type { CleanedRow } from './data-cleaner.service';

function makeRow(overrides: Partial<CleanedRow> = {}): CleanedRow {
  return {
    rowIndex: 0,
    nhc: null,
    patientName: null,
    birthDate: null,
    age: null,
    sex: null,
    admissionDate: null,
    diagnosis: null,
    procedure: null,
    phone: null,
    customFields: {},
    raw: {},
    ...overrides,
  } as CleanedRow;
}

describe('buildPatientInputFromRow (SDD import-data-quality)', () => {
  it('normalizes the patient name to title case and splits first/last', () => {
    const input = buildPatientInputFromRow(makeRow({ patientName: 'ANA GARCIA' }));
    expect(input.firstName).toBe('Ana');
    expect(input.lastName).toBe('Garcia');
  });

  it('uses null birthDate when none is present (NEVER the 1900-01-01 placeholder)', () => {
    const input = buildPatientInputFromRow(makeRow({ patientName: 'JUAN PEREZ' }));
    expect(input.birthDate).toBeNull();
  });

  it('passes through a computed birthDate (age-only row)', () => {
    const birth = new Date(Date.UTC(1976, 0, 1));
    const input = buildPatientInputFromRow(makeRow({ patientName: 'JUAN PEREZ', birthDate: birth }));
    expect(input.birthDate).toBe(birth);
  });

  it('assigns the extracted phone', () => {
    const input = buildPatientInputFromRow(makeRow({ patientName: 'JUAN PEREZ', phone: '666111222' }));
    expect(input.phone).toBe('666111222');
  });

  it('falls back to "Desconocido" firstName when the row has no name', () => {
    const input = buildPatientInputFromRow(makeRow({ patientName: null }));
    expect(input.firstName).toBe('Desconocido');
    expect(input.lastName).toBe('');
  });
});
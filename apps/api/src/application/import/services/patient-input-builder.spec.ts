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

  it('keeps birthDate null for an age-only row', () => {
    const input = buildPatientInputFromRow(makeRow({ patientName: 'JUAN PEREZ', age: 50, birthDate: null }));
    expect(input.birthDate).toBeNull();
  });

  it('assigns the extracted phone', () => {
    const input = buildPatientInputFromRow(makeRow({ patientName: 'JUAN PEREZ', phone: '666111222' }));
    expect(input.phone).toBe('666111222');
  });

  it('builds native demographic and emergency contact input', () => {
    const input = buildPatientInputFromRow(makeRow({
      patientName: 'ANA GARCIA', email: 'ana@example.com', idDocument: '12345678Z', idDocType: 'DNI',
      address: 'Calle Mayor 1', bloodType: 'A_POS', emergencyContactName: 'Luis Garcia',
      emergencyContactPhone: '677222333', emergencyContactRelationship: 'Cónyuge', notes: 'Importada',
    }));

    expect(input).toMatchObject({
      email: 'ana@example.com', idDocument: '12345678Z', idDocType: 'DNI', address: { street: 'Calle Mayor 1' },
      bloodType: 'A_POS', emergencyContact: { name: 'Luis Garcia', phone: '677222333', relationship: 'Cónyuge' },
      notes: 'Importada',
    });
  });

  it('falls back to "Desconocido" firstName when the row has no name', () => {
    const input = buildPatientInputFromRow(makeRow({ patientName: null }));
    expect(input.firstName).toBe('Desconocido');
    expect(input.lastName).toBe('');
  });

  it('keeps NHC-only names null when identity-light is enabled', () => {
    const input = buildPatientInputFromRow(makeRow({ nhc: '12345', patientName: null }), true);
    expect(input.firstName).toBeNull();
    expect(input.lastName).toBeNull();
  });
});

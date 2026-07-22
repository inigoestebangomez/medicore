// apps/api/src/application/import/import-data-quality.integration.spec.ts
// Integration wiring test (SDD import-data-quality T-11). Exercises the full
// clean() pipeline together with the patient-input builder over a single
// fixture covering all five import-data-quality fixes, then asserts the
// end-to-end CleanedRow → persisted-patient-parts shape (sans DB / BullMQ).

import { describe, it, expect } from '@jest/globals';
import { DataCleanerService } from './services/data-cleaner.service';
import { buildPatientInputFromRow } from './services/patient-input-builder';
import type { ColumnMapping, ParsedFile } from '@medicore/contracts';
import type { CleanResult } from './services/data-cleaner.service';

const cleaner = new DataCleanerService();

const mapping: ColumnMapping = {
  'NHC': 'nhc',
  'Paciente': 'patientName',
  'Fecha Nacimiento': 'birthDate',
  'Edad': 'age',
  'Teléfono': 'ignore',
};

const file: ParsedFile = {
  columns: ['NHC', 'Paciente', 'Fecha Nacimiento', 'Edad', 'Teléfono'],
  rows: [
    // 1) Uppercase name, missing birthDate but age present → title-case + age→birthDate
    { NHC: '1', Paciente: 'ANA GARCIA', 'Fecha Nacimiento': '', Edad: 50, 'Teléfono': '612345678' },
    // 2) Missing birthDate, no age → null birthDate (NOT 1900-01-01)
    { NHC: '2', Paciente: 'JUAN PEREZ', 'Fecha Nacimiento': '', Edad: '', 'Teléfono': '' },
    // 3) Age-only row (no birthDate column value) → birthDate computed from age
    { NHC: '3', Paciente: 'MARIA LOPEZ', 'Fecha Nacimiento': '', Edad: 30, 'Teléfono': '' },
    // 4) Multi-phone cell → patient phone extracted (first patient phone wins)
    { NHC: '4', Paciente: 'PEDRO RUIZ', 'Fecha Nacimiento': '1990-05-20', Edad: '', 'Teléfono': '666111222 698765432' },
    // 5) False record (equipment name) → flagged and skipped
    { NHC: '9', Paciente: 'Olympus Endoscope', 'Fecha Nacimiento': '', Edad: '', 'Teléfono': '' },
  ],
  sample: { columns: [], rows: [] },
  totalRows: 5,
  originalFormat: 'xlsx',
};

describe('import-data-quality end-to-end wiring (T-11)', () => {
  let result: CleanResult;

  it('runs the full clean() pipeline over the 5-fix fixture without crashing', () => {
    result = cleaner.clean(file, mapping);
    expect(result.cleanedRows.length).toBe(4); // 4 real rows, 1 false record skipped from cleanedRows
  });

  it('1) uppercase name + age → title-case persisted name and birthDate computed from age', () => {
    const ana = result.cleanedRows.find((r) => r.nhc === '1')!;
    const parts = buildPatientInputFromRow(ana);
    expect(parts.firstName).toBe('Ana');
    expect(parts.lastName).toBe('Garcia');
    const expectedYear = new Date().getFullYear() - 50;
    expect(parts.birthDate?.getFullYear()).toBe(expectedYear);
  });

  it('2) missing birthDate and no age → null birthDate (never 1900-01-01)', () => {
    const juan = result.cleanedRows.find((r) => r.nhc === '2')!;
    const parts = buildPatientInputFromRow(juan);
    expect(parts.birthDate).toBeNull();
    expect(parts.birthDate?.toISOString()).not.toBe('1900-01-01T00:00:00.000Z');
  });

  it('3) age-only row → birthDate computed from age', () => {
    const maria = result.cleanedRows.find((r) => r.nhc === '3')!;
    const expectedYear = new Date().getFullYear() - 30;
    expect(maria.birthDate?.getFullYear()).toBe(expectedYear);
  });

  it('4) multi-phone cell → patient phone extracted', () => {
    const pedro = result.cleanedRows.find((r) => r.nhc === '4')!;
    expect(pedro.phone).toBe('666111222');
    const parts = buildPatientInputFromRow(pedro);
    expect(parts.phone).toBe('666111222');
  });

  it('5) equipment-name row → flagged as a false record and not present in cleaned rows', () => {
    expect(result.falseRecordRowIndices).toContain(4);
    expect(result.cleanedRows.find((r) => r.nhc === '9')).toBeUndefined();
    expect(result.reasons.some((r) => r.rowIndex === 4 && r.reason.includes('false record'))).toBe(true);
  });
});
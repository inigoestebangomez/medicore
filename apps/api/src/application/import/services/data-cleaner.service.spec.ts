// apps/api/src/application/import/services/data-cleaner.service.spec.ts
import { describe, it, expect } from '@jest/globals';
import { DataCleanerService } from './data-cleaner.service';
import type { ColumnMapping, ParsedFile } from '@medicore/contracts';

const cleaner = new DataCleanerService();

function makeFile(rows: Record<string, unknown>[], columns = ['NHC', 'Nombre', 'Edad']): ParsedFile {
  return { columns, rows, sample: { columns, rows: rows.slice(0, 20) }, totalRows: rows.length, originalFormat: 'xlsx' };
}

describe('DataCleanerService', () => {
  describe('Excel serial → date conversion (spec §3)', () => {
    it('should convert serial 46023 → 2026-01-01 (Excel epoch + Lotus 1-2-3 bug)', () => {
      const date = cleaner.convertExcelSerial(46023);
      expect(date.toISOString().slice(0, 10)).toBe('2026-01-01');
    });

    it('should convert serial 45000 correctly', () => {
      const date = cleaner.convertExcelSerial(45000);
      expect(date.toISOString().slice(0, 10)).toBe('2023-03-15');
    });

    it('parseDate should accept a number serial in plausible range', () => {
      expect(cleaner.parseDate(46023)?.toISOString().slice(0, 10)).toBe('2026-01-01');
      // NHC-sized numbers are NOT dates
      expect(cleaner.parseDate(18685362)).toBeNull();
    });

    it('parseDate should accept an ISO date string', () => {
      expect(cleaner.parseDate('2026-01-15')?.toISOString().slice(0, 10)).toBe('2026-01-15');
    });

    it('parseDate should handle Spanish dd/mm/yyyy strings', () => {
      expect(cleaner.parseDate('15/01/2026')?.toISOString().slice(0, 10)).toBe('2026-01-15');
    });

    it('parseDate should accept Excel serial 45678 → 2025-01-21', () => {
      expect(cleaner.parseDate(45678)?.toISOString().slice(0, 10)).toBe('2025-01-21');
    });
  });

  describe('parseDate extended formats (SDD import-data-quality)', () => {
    // All assertions compare epoch ms against Date.UTC so they are stable
    // regardless of the host timezone: parsed dates land on UTC midnight.
    const utc = (y: number, m: number, d: number) => Date.UTC(y, m, d);

    it('parses Spanish slash date without leading zeros "1/1/1976"', () => {
      expect(cleaner.parseDate('1/1/1976')?.getTime()).toBe(utc(1976, 0, 1));
    });

    it('still parses Spanish slash date with leading zeros "01/01/1976"', () => {
      expect(cleaner.parseDate('01/01/1976')?.getTime()).toBe(utc(1976, 0, 1));
    });

    it('parses dash date "15-03-1982" → 1982-03-15', () => {
      expect(cleaner.parseDate('15-03-1982')?.getTime()).toBe(utc(1982, 2, 15));
    });

    it('parses ISO date "2024-06-15" → 2024-06-15', () => {
      expect(cleaner.parseDate('2024-06-15')?.getTime()).toBe(utc(2024, 5, 15));
    });

    it('parses two-digit year "5/3/68" → 1968 (rolling threshold; current year 2026 → 26)', () => {
      // 68 > 26 → 1900 + 68 = 1968. Spanish d/m/yy → 5 March 1968.
      expect(cleaner.parseDate('5/3/68')?.getTime()).toBe(utc(1968, 2, 5));
    });

    it('returns null for an empty date string', () => {
      expect(cleaner.parseDate('')).toBeNull();
    });

    it('returns null for an invalid date string "not a date"', () => {
      expect(cleaner.parseDate('not a date')).toBeNull();
    });

    it('returns null for null input', () => {
      expect(cleaner.parseDate(null)).toBeNull();
    });
  });

  describe('ageToBirthDate (SDD import-data-quality)', () => {
    const utc = (y: number, m: number, d: number) => Date.UTC(y, m, d);

    it('age 50 with ref 2026-07-22 → Jan 1, 1976', () => {
      const ref = new Date(2026, 6, 22);
      expect(cleaner.ageToBirthDate(50, ref)?.getTime()).toBe(utc(1976, 0, 1));
    });

    it('age 0 with ref 2026-07-22 → Jan 1, 2026', () => {
      const ref = new Date(2026, 6, 22);
      expect(cleaner.ageToBirthDate(0, ref)?.getTime()).toBe(utc(2026, 0, 1));
    });

    it('age 130 with ref 2026-07-22 → Jan 1, 1896', () => {
      const ref = new Date(2026, 6, 22);
      expect(cleaner.ageToBirthDate(130, ref)?.getTime()).toBe(utc(1896, 0, 1));
    });
  });

  describe('text normalization', () => {
    it('normalizeMatchable strips accents and lowercases (periamigdalino)', () => {
      expect(cleaner.normalizeMatchable('PERiamigdalino')).toBe('periamigdalino');
      expect(cleaner.normalizeMatchable('Periamigdalino')).toBe('periamigdalino');
    });
    it('normalizeMatchable returns null for empty', () => {
      expect(cleaner.normalizeMatchable('')).toBeNull();
    });
  });

  describe('mixed-cell parsing (spec parsePatientIdentifier)', () => {
    it('should detect "EDUARDO MARTINEZ (45)" as name + age, no NHC', () => {
      const r = cleaner.parseMixedCell('EDUARDO MARTINEZ (45)');
      expect(r.name).toBe('EDUARDO MARTINEZ');
      expect(r.age).toBe(45);
      expect(r.nhc).toBeNull();
    });
    it('should parse "1.8685362E7" → NHC 18685362', () => {
      const r = cleaner.parseMixedCell('1.8685362E7');
      expect(r.nhc).toBe('18685362');
    });
    it('should parse a plain 8-digit number → NHC', () => {
      const r = cleaner.parseMixedCell('13046043');
      expect(r.nhc).toBe('13046043');
    });
    it('should parse "NOMBRE (HOME, 25 anys)" → name + age + sex MALE', () => {
      const r = cleaner.parseMixedCell('NOMBRE (HOME, 25 anys)');
      expect(r.name).toBe('NOMBRE');
      expect(r.age).toBe(25);
      expect(r.sex).toBe('MALE');
    });
  });

  describe('junk row detection (spec §3 isJunkRow)', () => {
    it('should flag single-cell note "X=2,4"', () => {
      expect(cleaner.isJunkRow({ NHC: '', Nie: 'X=2,4 — media global' })).toBe(true);
    });
    it('should flag empty row', () => {
      expect(cleaner.isJunkRow({ NHC: '', Nombre: '' })).toBe(true);
    });
    it('should flag "robot daVinci Xi." note row', () => {
      expect(cleaner.isJunkRow({ NHC: '', Nota: 'robot daVinci Xi.' })).toBe(true);
    });
    it('should NOT flag a real patient row with NHC', () => {
      expect(cleaner.isJunkRow({ NHC: '13046043', Nombre: 'Ana' })).toBe(false);
    });
  });

  describe('full clean() pipeline', () => {
    it('should produce cleaned rows, skip junk, and extract patient phone to cleaned.phone (BR-IMP-007 inverted)', () => {
      const mapping: ColumnMapping = {
        'Nº HISTORIA': 'nhc',
        'Paciente': 'patientName',
        'Edad': 'age',
        'Teléfono': 'ignore',       // ignored for field-walk, but scanned by the phone extractor
        'Fecha Nacimiento': 'birthDate',
      };
      const file = makeFile([
        { 'Nº HISTORIA': '13046043', Paciente: 'ANA GARCIA', Edad: 45, 'Teléfono': '666111222', 'Fecha Nacimiento': 46023 },
        { 'Nº HISTORIA': '', Paciente: '', Edad: '', 'Teléfono': '', 'Fecha Nacimiento': '' }, // junk
        { 'Nº HISTORIA': '', Paciente: 'IVAN (50)', Edad: '', 'Teléfono': '999', 'Fecha Nacimiento': '' },
      ], ['Nº HISTORIA', 'Paciente', 'Edad', 'Teléfono', 'Fecha Nacimiento']);

      const result = cleaner.clean(file, mapping);

      expect(result.cleanedRows.length).toBe(2);
      expect(result.junkRowIndices).toContain(1);

      const ana = result.cleanedRows[0];
      expect(ana.nhc).toBe('13046043');
      expect(ana.patientName).toBe('ANA GARCIA');
      expect(ana.age).toBe(45);
      expect(ana.birthDate?.toISOString().slice(0, 10)).toBe('2026-01-01');
      // The phone extractor scans the original row and lands the patient phone
      // on the new cleaned.phone field (BR-IMP-007 inverted: phone is no longer
      // excluded from cleaned output — it is captured on a dedicated field).
      expect(ana.phone).toBe('666111222');

      // Mixed-cell name + age parsing for the third row (no NHC, name present)
      const ivan = result.cleanedRows[1];
      expect(ivan.patientName).toBe('IVAN');
      expect(ivan.age).toBe(50);
      // '999' is not a Spanish phone (must start with 6-9 and have 9 digits).
      expect(ivan.phone).toBeNull();
    });

    it('should flag false records (equipment/brand name) into falseRecordRowIndices', () => {
      const mapping: ColumnMapping = {
        'NHC': 'nhc',
        'Paciente': 'patientName',
        'Edad': 'age',
      };
      const file = makeFile([
        { NHC: '1', Paciente: 'JUAN PEREZ', Edad: 50 },
        { NHC: '2', Paciente: 'PENDIENTE REVISIÓN', Edad: '' }, // false record (admin note)
      ], ['NHC', 'Paciente', 'Edad']);

      const result = cleaner.clean(file, mapping);

      expect(result.cleanedRows.map((r) => r.patientName)).toEqual(['JUAN PEREZ']);
      expect(result.falseRecordRowIndices).toContain(1);
      expect(result.reasons.some((r) => r.rowIndex === 1 && r.reason.includes('false record'))).toBe(true);
    });

    it('should compute birthDate from age when no birthDate column is present', () => {
      const mapping: ColumnMapping = { 'NHC': 'nhc', 'Paciente': 'patientName', 'Edad': 'age' };
      const file = makeFile([
        { NHC: '1', Paciente: 'JUAN PEREZ', Edad: 50 },
      ], ['NHC', 'Paciente', 'Edad']);

      const result = cleaner.clean(file, mapping);

      // age 50 → Jan 1 of (currentYear - 50)
      const expectedYear = new Date().getFullYear() - 50;
      expect(result.cleanedRows[0].birthDate?.toISOString()).toMatch(new RegExp(`^${expectedYear}-01-01T00:00:00`));
    });

    it('should let a phone-named column mapped to custom flow through (no longer stripped)', () => {
      const mapping: ColumnMapping = {
        'NHC': 'nhc',
        'Móvil': 'custom',        // phone-named but mapped custom — must NOT be skipped
      };
      const file = makeFile([
        { NHC: '1', 'Móvil': '612345678' },
      ], ['NHC', 'Móvil']);

      const result = cleaner.clean(file, mapping);

      const row = result.cleanedRows[0];
      // Column walk no longer drops phone-named columns: the custom mapping holds.
      expect(row.customFields['Móvil']).toBe('612345678');
      // The extractor still scanned the original row and captured the phone.
      expect(row.phone).toBe('612345678');
    });

    it('should skip rows lacking minimum identifiable info (no NHC and no name)', () => {
      const mapping: ColumnMapping = { 'NHC': 'nhc', 'Edad': 'age' };
      const file = makeFile([
        { NHC: '', Edad: 50 },     // no name, no NHC → skip (even though junk check passes since <3 cells with values? hasPatientId false and values.length<3 → junk)
        { NHC: '123456', Edad: 40 },
      ], ['NHC', 'Edad']);
      const result = cleaner.clean(file, mapping);
      // The first row is junk (single value "Edad=50", hasPatientId false, values.length<3)
      // → recorded in junkRowIndices, not skippedRowIndices. Either way it must not appear cleaned.
      expect(result.cleanedRows.length).toBe(1);
      expect(result.cleanedRows[0].nhc).toBe('123456');
    });

    it('should collect custom fields from custom-mapped columns', () => {
      const mapping: ColumnMapping = { 'NHC': 'nhc', 'Abordaje': 'custom' };
      const file = makeFile([
        { NHC: '1', Abordaje: 'Laterocervical derecha' },
      ], ['NHC', 'Abordaje']);
      const result = cleaner.clean(file, mapping);
      expect(result.cleanedRows[0].customFields['Abordaje']).toBe('Laterocervical derecha');
    });
  });

  describe('sex normalization (maps to Prisma Sex enum: MALE, FEMALE, OTHER, UNKNOWN)', () => {
    it('should map HOME/HOMBRE/H/MALE → MALE', () => {
      expect(cleaner.normalizeSex('H')).toBe('MALE');
      expect(cleaner.normalizeSex('HOME')).toBe('MALE');
      expect(cleaner.normalizeSex('hombre')).toBe('MALE');
      expect(cleaner.normalizeSex('MALE')).toBe('MALE');
      expect(cleaner.normalizeSex('VARÓN')).toBe('MALE');
    });
    it('should map DONA/MUJER/M/FEMALE → FEMALE', () => {
      expect(cleaner.normalizeSex('DONA')).toBe('FEMALE');
      expect(cleaner.normalizeSex('mujer')).toBe('FEMALE');
      expect(cleaner.normalizeSex('M')).toBe('FEMALE');
      expect(cleaner.normalizeSex('FEMALE')).toBe('FEMALE');
    });
    it('should map OTHER/O → OTHER', () => {
      expect(cleaner.normalizeSex('O')).toBe('OTHER');
      expect(cleaner.normalizeSex('OTHER')).toBe('OTHER');
    });
    it('should return null for unrecognized values', () => {
      expect(cleaner.normalizeSex('XYZ')).toBeNull();
      expect(cleaner.normalizeSex('')).toBeNull();
      expect(cleaner.normalizeSex(null)).toBeNull();
    });
  });
});
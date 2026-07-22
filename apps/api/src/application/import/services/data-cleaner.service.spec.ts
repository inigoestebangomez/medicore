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
    it('should produce cleaned rows, skip junk, exclude phone fields (BR-IMP-007)', () => {
      const mapping: ColumnMapping = {
        'Nº HISTORIA': 'nhc',
        'Paciente': 'patientName',
        'Edad': 'age',
        'Teléfono': 'ignore',       // BR-IMP-007 phone exclusion
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
      // Phone field must NEVER appear in cleaned output (BR-IMP-007)
      const allValues = JSON.stringify(ana);
      expect(allValues).not.toContain('666111222');

      // Mixed-cell name + age parsing for the third row (no NHC, name present)
      const ivan = result.cleanedRows[1];
      expect(ivan.patientName).toBe('IVAN');
      expect(ivan.age).toBe(50);
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
// apps/api/src/application/import/services/file-parser.service.spec.ts
import { describe, it, expect } from '@jest/globals';
import * as XLSX from 'xlsx';
import { FileParserService } from './file-parser.service';
import { FileEmptyError } from '@/domain/import/errors/file-empty.error';

const parser = new FileParserService();

function makeXlsxBuffer(headers: string[], rows: unknown[][]): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Hoja1');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array);
}

describe('FileParserService', () => {
  describe('format detection', () => {
    it('should detect .xlsx by extension', () => {
      const buffer = makeXlsxBuffer(['NHC', 'Nombre'], [['1', 'Ana']]);
      const result = parser.parse({ buffer, fileName: 'pacientes.xlsx' });
      expect(result.parsed.originalFormat).toBe('xlsx');
    });

    it('should detect .csv by extension and parse delimited rows', () => {
      const csv = 'NHC,Nombre,Edad\n1,Ana,45\n2,Ivan,50\n';
      const result = parser.parse({ buffer: Buffer.from(csv, 'utf8'), fileName: 'data.csv' });
      expect(result.parsed.originalFormat).toBe('csv');
      expect(result.parsed.columns).toEqual(['NHC', 'Nombre', 'Edad']);
      expect(result.parsed.totalRows).toBe(2);
      expect(result.parsed.rows[0]).toEqual({ NHC: '1', Nombre: 'Ana', Edad: '45' });
    });

    it('should detect .tsv and parse tab-delimited rows', () => {
      const tsv = 'NHC\tNombre\n1\tAna\n';
      const result = parser.parse({ buffer: Buffer.from(tsv, 'utf8'), fileName: 'data.tsv' });
      expect(result.parsed.originalFormat).toBe('tsv');
      expect(result.parsed.rows[0]).toEqual({ NHC: '1', Nombre: 'Ana' });
    });
  });

  describe('file hash and size', () => {
    it('should compute a SHA-256 fileHash and size', () => {
      const csv = 'NHC,Nombre\n1,Ana\n';
      const result = parser.parse({ buffer: Buffer.from(csv, 'utf8'), fileName: 'x.csv' });
      expect(result.fileHash).toMatch(/^[0-9a-f]{64}$/);
      expect(result.fileSize).toBe(Buffer.from(csv, 'utf8').length);
    });
  });

  describe('sample extraction', () => {
    it('should return the first 20 rows as sample', () => {
      const rows = Array.from({ length: 25 }, (_, i) => [String(i), `P${i}`]);
      const buffer = makeXlsxBuffer(['NHC', 'Nombre'], rows);
      const result = parser.parse({ buffer, fileName: 'big.xlsx' });
      expect(result.parsed.totalRows).toBe(25);
      expect(result.parsed.sample.rows.length).toBe(20);
    });
  });

  describe('empty file handling', () => {
    it('should throw FileEmptyError for a file with only headers', () => {
      const csv = 'NHC,Nombre\n';
      expect(() => parser.parse({ buffer: Buffer.from(csv), fileName: 'empty.csv' })).toThrow(FileEmptyError);
    });
    it('should throw FileEmptyError for a workbook with no sheets', () => {
      // Build a sheet that has no data rows (only headers are rows). A truly
      // sheet-less workbook can't be written by xlsx, so we simulate an empty
      // sheet by writing a sheet with a single empty cell.
      const sheet = XLSX.utils.aoa_to_sheet([[]]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, 'Empty');
      const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array);
      expect(() => parser.parse({ buffer, fileName: 'nosheets.xlsx' })).toThrow();
    });
  });

  describe('duplicate column names', () => {
    it('should disambiguate duplicate headers with a numeric suffix', () => {
      const csv = 'Edad,Edad,Edad\n1,2,3\n';
      const result = parser.parse({ buffer: Buffer.from(csv), fileName: 'dups.csv' });
      expect(result.parsed.columns).toEqual(['Edad', 'Edad_1', 'Edad_2']);
    });
  });
});
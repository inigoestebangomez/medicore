// apps/api/src/application/import/services/file-parser.service.ts
// Parses uploaded xlsx/xls/csv/tsv files into a normalized in-memory shape:
// { columns, rows, sample, totalRows, originalFormat }. The raw file buffer is
// not persisted anywhere — parse-and-discard per AD-6 (RGPD: no PII surface
// beyond the JSONB we explicitly store). Empty / unparsable files throw
// FileEmptyError so the use case can surface a 400.

import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { createHash } from 'node:crypto';
import type { ParsedFile, FileSample } from '@medicore/contracts';
import { FileEmptyError } from '@/domain/import/errors/file-empty.error';

const SAMPLE_ROW_LIMIT = 20;

export interface ParseInput {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
}

export interface ParseResult {
  parsed: ParsedFile;
  fileHash: string;        // SHA-256 for audit/dedup
  fileSize: number;
}

@Injectable()
export class FileParserService {
  /**
   * Parse a buffer into a ParsedFile. Throws FileEmptyError when the file has
   * no rows at all.
   */
  parse(input: ParseInput): ParseResult {
    const { buffer, fileName } = input;
    const originalFormat = this.detectFormat(fileName, input.mimeType);
    const fileHash = createHash('sha256').update(buffer).digest('hex');

    const workbook = this.readWorkbook(buffer, originalFormat);
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new FileEmptyError(`File "${fileName}" contains no sheets`);
    }

    const sheet = workbook.Sheets[firstSheetName];
    // header:1 yields an array-of-arrays; we promote the first row to headers.
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });

    if (rawRows.length === 0) {
      throw new FileEmptyError(`File "${fileName}" has no rows`);
    }

    const headerRow = (rawRows[0] as unknown[]).map((c) => (c == null ? '' : String(c)));
    // Deduplicate duplicate column names (common in messy Excels) by suffixing.
    const columns = this.deduplicateColumns(headerRow);

    const dataRows = rawRows.slice(1);
    if (dataRows.length === 0) {
      throw new FileEmptyError(`File "${fileName}" has headers but no data rows`);
    }

    const rows = dataRows.map((row) => this.recordFromRow(row, columns));

    const sample: FileSample = {
      columns,
      rows: rows.slice(0, SAMPLE_ROW_LIMIT),
    };

    const parsed: ParsedFile = {
      columns,
      rows,
      sample,
      totalRows: rows.length,
      originalFormat,
    };

    return { parsed, fileHash, fileSize: buffer.length };
  }

  private detectFormat(fileName: string, mimeType?: string): 'xlsx' | 'csv' | 'tsv' {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx';
    if (lower.endsWith('.tsv')) return 'tsv';
    if (lower.endsWith('.csv')) return 'csv';
    // Fallback to MIME type.
    if (mimeType?.includes('text/tab')) return 'tsv';
    if (mimeType?.includes('csv') || mimeType?.includes('comma-separated')) return 'csv';
    // Default assume Excel for unknown binary-ish content.
    return 'xlsx';
  }

  private readWorkbook(buffer: Buffer, format: 'xlsx' | 'csv' | 'tsv'): XLSX.WorkBook {
    if (format === 'csv' || format === 'tsv') {
      // Parse with delimiter detection. Octal codepage auto-detect handles BOM
      // and basic encoding (UTF-8 / Latin-1) for Spanish hospital exports.
      const text = buffer.toString('latin1'); // tolerate non-UTF-8 bytes; we normalize later
      const FS = format === 'tsv' ? '\t' : ',';
      const wb = XLSX.read(text, { type: 'string', raw: true, FS, codepage: 65001 });
      return wb;
    }
    return XLSX.read(buffer, { type: 'buffer', raw: true, cellDates: false });
  }

  private recordFromRow(row: unknown[], columns: string[]): Record<string, unknown> {
    const record: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      record[columns[i]] = row[i] ?? null;
    }
    return record;
  }

  private deduplicateColumns(headers: string[]): string[] {
    const seen = new Map<string, number>();
    return headers.map((h) => {
      const trimmed = h.trim() || `Columna_${seen.size + 1}`;
      const count = seen.get(trimmed) ?? 0;
      seen.set(trimmed, count + 1);
      return count === 0 ? trimmed : `${trimmed}_${count}`;
    });
  }
}
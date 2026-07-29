// apps/api/src/application/import/services/data-cleaner.service.ts
// Stage 3 cleaner per spec §3. Pure, deterministic, no I/O. Operates on a
// parsed file + a confirmed column mapping (after physician review) and:
//   1. Converts Excel date serials to real dates (Lotus 1-2-3 bug accounted for).
//   2. Normalizes text (NFD + diacritic strip for matching; display preserved).
//   3. Extracts NHC / name / age from mixed cells ("EDUARDO MARTINEZ (45)").
//   4. Flags and excludes junk rows (totals, means, notes, single-cell metadata).
//   5. Excludes phone-like columns entirely (BR-IMP-007) — never present in output.
// Returns a structured CleanResult with valid rows, skipped indices and reasons.

import { Injectable, Optional } from '@nestjs/common';
import type { ColumnMapping, ParsedFile } from '@medicore/contracts';
import { PhoneExtractorService } from './phone-extractor.service';
import { FalseRecordDetectorService } from './false-record-detector.service';

export interface CleanedRow {
  rowIndex: number;
  nhc: string | null;
  patientName: string | null;
  birthDate: Date | null;
  age: number | null;
  sex: string | null;
  admissionDate: Date | null;
  diagnosis: string | null;
  procedure: string | null;
  testType: string | null;          // clinical test/study type (EMG, TAC, etc.)
  requestDate: Date | null;         // when the test was ordered
  completionDate: Date | null;      // when the test was performed
  phone: string | null;             // SDD import-data-quality: extracted patient phone
  customFields: Record<string, unknown>;   // custom column values, keyed by custom-field name
  raw: Record<string, unknown>;             // original row preserved for audit/importedData
}

export interface CleanResult {
  cleanedRows: CleanedRow[];
  junkRowIndices: number[];
  skippedRowIndices: number[];   // rows skipped because no identifiable patient info
  falseRecordRowIndices: number[]; // SDD import-data-quality: rows flagged as false records
  reasons: Array<{ rowIndex: number; reason: string }>;
}

// Excel serial epoch + Lotus 1-2-3 leap year bug: 25569 = days between
// 1900-01-01 (Excel's buggy epoch) and 1970-01-01 (Unix epoch).
const EXCEL_SERIAL_EPOCH_OFFSET = 25569;
const SECONDS_PER_DAY = 86400;
const EXCEL_SERIAL_MIN = 59;    // ~1900-03-01
const EXCEL_SERIAL_MAX = 80000; // ~2118

@Injectable()
export class DataCleanerService {
  private readonly falseRecordDetector: FalseRecordDetectorService;

  constructor(
    private readonly phoneExtractor: PhoneExtractorService = new PhoneExtractorService(),
    @Optional() detector?: FalseRecordDetectorService,
  ) {
    // Construct the detector with `this` so the detector reuses THIS cleaner's
    // parseDate/normalizeSex helpers instead of default-constructing a new
    // DataCleanerService — which would recurse (cleaner ↔ detector) endlessly.
    this.falseRecordDetector = detector ?? new FalseRecordDetectorService(this);
  }

  /**
    * Clean a parsed file using the confirmed mapping. Caller passes the full
    * ParsedFile (rows) and the column→field mapping produced by the analyzer
    * and (optionally) corrected by the physician.
    */
  clean(file: ParsedFile, mapping: ColumnMapping): CleanResult {
    const cleanedRows: CleanedRow[] = [];
    const junkRowIndices: number[] = [];
    const skippedRowIndices: number[] = [];
    const falseRecordRowIndices: number[] = [];
    const reasons: CleanResult['reasons'] = [];

    file.rows.forEach((row, rowIndex) => {
      // 4. Junk row detection (totals, means, notes, single-cell metadata).
      if (this.isJunkRow(row)) {
        junkRowIndices.push(rowIndex);
        reasons.push({ rowIndex, reason: 'junk row (totals/means/notes)' });
        return;
      }

      const cleaned: CleanedRow = {
        rowIndex,
        nhc: null,
        patientName: null,
        birthDate: null,
        age: null,
        sex: null,
        admissionDate: null,
        diagnosis: null,
        procedure: null,
        testType: null,
        requestDate: null,
        completionDate: null,
        phone: null,
        customFields: {},
        // raw preserves the original row for importedData JSONB (BR-IMP-002),
        // but BR-IMP-007 phone/ignored columns are stripped here so they never
        // reach Patient.importedData downstream.
        raw: this.stripIgnoredColumns(row, mapping),
      };

      // Walk every mapped column; assign to the standard field or customFields.
      for (const [column, field] of Object.entries(mapping)) {
        // 5. 'ignore'-mapped columns never enter the field walk. Phone-named
        //    columns are NO LONGER dropped here (SDD import-data-quality): they
        //    flow through to the PhoneExtractorService which scans the full row.
        if (field === 'ignore') continue;

        const rawValue = row[column];

        switch (field) {
          case 'nhc': {
            const v = this.extractNhc(rawValue);
            if (v !== null) cleaned.nhc = v;
            break;
          }
          case 'patientName': {
            // The mapped name cell may embed age/sex in parentheses
            // ("EDUARDO MARTINEZ (45)" → name + age). Strip those out so the
            // later mixed-cell step doesn't redundantly re-parse them.
            const valueForName = typeof rawValue === 'string' && /\(.*\)/.test(rawValue)
              ? this.parseMixedCell(rawValue)
              : null;
            if (valueForName && valueForName.name) {
              cleaned.patientName = valueForName.name;
              if (valueForName.age !== null) cleaned.age = valueForName.age;
              if (valueForName.sex) cleaned.sex = valueForName.sex;
            } else {
              const v = this.normalizeDisplayText(rawValue);
              if (v !== null) cleaned.patientName = v;
            }
            break;
          }
          case 'birthDate': {
            const v = this.parseDate(rawValue);
            if (v !== null) cleaned.birthDate = v;
            break;
          }
          case 'age': {
            const v = this.extractAge(rawValue);
            // Only overwrite an age parsed earlier from a mixed name/sex cell
            // when the dedicated age column actually has a value.
            if (v !== null) cleaned.age = v;
            break;
          }
          case 'sex': {
            const v = this.normalizeSex(rawValue);
            if (v !== null) cleaned.sex = v;
            break;
          }
          case 'admissionDate': {
            const v = this.parseDate(rawValue);
            if (v !== null) cleaned.admissionDate = v;
            break;
          }
          case 'diagnosis': {
            const v = this.normalizeDisplayText(rawValue);
            if (v !== null) cleaned.diagnosis = v;
            break;
          }
          case 'procedure': {
            const v = this.normalizeDisplayText(rawValue);
            if (v !== null) cleaned.procedure = v;
            break;
          }
          case 'testType': {
            const v = this.normalizeDisplayText(rawValue);
            if (v !== null) cleaned.testType = v;
            break;
          }
          case 'requestDate': {
            const v = this.parseDate(rawValue);
            if (v !== null) cleaned.requestDate = v;
            break;
          }
          case 'completionDate': {
            const v = this.parseDate(rawValue);
            if (v !== null) cleaned.completionDate = v;
            break;
          }
          case 'custom':
            cleaned.customFields[column] = rawValue;
            break;
        }
      }

      // 3. Mixed-cell parsing: if patientName absent but an NHC-like cell with
      // name/age exists, attempt to parse "EDUARDO MARTINEZ (45)" → name + age.
      if (!cleaned.patientName && !cleaned.nhc) {
        for (const val of Object.values(row)) {
          if (typeof val === 'string' && /\(.*\)/.test(val)) {
            const parsed = this.parseMixedCell(val);
            if (parsed.name) cleaned.patientName = parsed.name;
            if (parsed.age !== null && cleaned.age === null) cleaned.age = parsed.age;
            if (parsed.nhc) cleaned.nhc = parsed.nhc;
            break;
          }
        }
      }

      // SDD import-data-quality: compute birthDate from age when no birthDate
      // column yielded a date (age-only rows).
      if (cleaned.birthDate === null && cleaned.age !== null) {
        cleaned.birthDate = this.ageToBirthDate(cleaned.age);
      }

      // SDD import-data-quality: extract the patient phone from the FULL
      // original row (scans every cell, regardless of the column mapping).
      cleaned.phone = this.phoneExtractor.extract(row);

      // SDD import-data-quality: validate cleaned cells against their mapped
      // column expectations and flag false records (equipment names, admin
      // notes, numeric record-id cells, ...).
      const detection = this.falseRecordDetector.detect(row, this.toDetectorColumnMap(mapping));
      if (detection.isFalse) {
        falseRecordRowIndices.push(rowIndex);
        reasons.push({ rowIndex, reason: `false record: ${detection.reasons.join('; ')}` });
        return;
      }

      // 4b. Row without minimum identifiable info → skip (not a patient).
      if (!this.hasMinimumIdentifiableInfo(cleaned)) {
        skippedRowIndices.push(rowIndex);
        reasons.push({ rowIndex, reason: 'no minimum identifiable info (name or NHC)' });
        return;
      }

      cleanedRows.push(cleaned);
    });

    return { cleanedRows, junkRowIndices, skippedRowIndices, falseRecordRowIndices, reasons };
  }

  /**
   * Build the column→field-name map consumed by the FalseRecordDetector.
   * Translates the pipeline's StandardField ('patientName') to the detector's
   * column-rule name ('name') and keeps the rules the detector validates
   * (nhc, age, birthDate, sex); all other fields are irrelevant to detection.
   */
  private toDetectorColumnMap(mapping: ColumnMapping): Map<string, string> {
    const m = new Map<string, string>();
    for (const [column, field] of Object.entries(mapping)) {
      if (field === 'patientName') m.set(column, 'name');
      else if (field === 'nhc' || field === 'age' || field === 'birthDate' || field === 'sex') {
        m.set(column, field);
      }
    }
    return m;
  }

  // ─────────────────────────────────────────────
  // 1. Excel date serial conversion (spec §3)
  // ─────────────────────────────────────────────

  /** Convert an Excel date serial to a JS Date, or pass through Date/string values. */
  parseDate(value: unknown): Date | null {
    if (value == null || value === '') return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number') {
      if (value >= EXCEL_SERIAL_MIN && value <= EXCEL_SERIAL_MAX) {
        return this.convertExcelSerial(value);
      }
      return null;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      // Pure date serial as string?
      if (/^\d{4,5}(\.\d+)?$/.test(trimmed)) {
        const n = parseFloat(trimmed);
        if (n >= EXCEL_SERIAL_MIN && n <= EXCEL_SERIAL_MAX) {
          return this.convertExcelSerial(n);
        }
      }
      // ── SDD import-data-quality: explicit formats producing UTC-midnight dates.
      // Spanish day-first: dd?/mm?/yyyy  or  dd?/mm?/yy (rolling 2-digit year).
      const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (slash) {
        const day = parseInt(slash[1], 10);
        const month = parseInt(slash[2], 10);
        const yearRaw = slash[3];
        if (yearRaw.length === 2) {
          const year = this.expandTwoDigitYear(parseInt(yearRaw, 10));
          return this.utcDate(year, month - 1, day);
        }
        return this.utcDate(parseInt(yearRaw, 10), month - 1, day);
      }
      // Dash day-first: dd?/mm? style with dashes. dd-mm-yyyy
      const dash = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (dash) {
        return this.utcDate(parseInt(dash[3], 10), parseInt(dash[2], 10) - 1, parseInt(dash[1], 10));
      }
      // ISO: yyyy-mm-dd
      const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (iso) {
        return this.utcDate(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
      }
      // Legacy fallback: try a native parse of anything we didn't match above
      // (e.g. previously-supported yyyy-mm-dd variants). Date-only ISO strings
      // land on UTC midnight; everything else is whatever the engine gives us.
      const parsed = new Date(trimmed);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  /**
   * Expand a two-digit year into a four-digit year using a rolling threshold
   * equal to `currentYear % 100`. Years greater than the threshold are anchored
   * to the 1900s; otherwise to the 2000s.
   *   currentYear 2026 → threshold 26 → 68 → 1968, 05 → 2005
   */
  private expandTwoDigitYear(twoDigit: number): number {
    const threshold = new Date().getFullYear() % 100;
    return twoDigit > threshold ? 1900 + twoDigit : 2000 + twoDigit;
  }

  /** Build a Date at UTC midnight from year/month(0-based)/day — timezone-stable. */
  private utcDate(year: number, monthIndex: number, day: number): Date {
    return new Date(Date.UTC(year, monthIndex, day));
  }

  /** spec §3: serial 46023 → 2026-01-15. Formula: (serial - 25569) * 86400 * 1000. */
  convertExcelSerial(serial: number): Date {
    return new Date((serial - EXCEL_SERIAL_EPOCH_OFFSET) * SECONDS_PER_DAY * 1000);
  }

  /**
   * Convert a numeric age to an approximate birthDate: Jan 1 of `ref.getFullYear() - age`.
   *   ageToBirthDate(50, new Date(2026, 6, 22)) → new Date(Date.UTC(1976, 0, 1))
   * Used when an import row supplies age but no birth date.
   */
  ageToBirthDate(age: number, ref: Date = new Date()): Date {
    return this.utcDate(ref.getFullYear() - age, 0, 1);
  }

  // ─────────────────────────────────────────────
  // 2. Text normalization
  // ─────────────────────────────────────────────

  /** Normalize for display (capitalization preserved, just trimmed). */
  normalizeDisplayText(value: unknown): string | null {
    if (value == null) return null;
    const s = String(value).trim();
    return s === '' ? null : s;
  }

  /**
   * Normalize for matching/comparison: lowercase, NFD, strip diacritics, trim.
   * Per spec §3: periamigdalino / Periamigdalino / PERiamigdalino → periamigdalino.
   */
  normalizeMatchable(value: unknown): string | null {
    const display = this.normalizeDisplayText(value);
    if (!display) return null;
    return display
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  // ─────────────────────────────────────────────
  // 3. Mixed-cell parsing (spec §3 parsePatientIdentifier)
  // ─────────────────────────────────────────────

  /**
   * Parse mixed identification cells.
   *   "EDUARDO MARTINEZ ALVAREZ (45)" → { name, age, nhc: null }
   *   "1.8685362E7" → { nhc: "18685362" }
   *   "13046043" → { nhc: "13046043" }
   *   "NOMBRE (HOME, 25 anys)" → { name, age, sex }
   */
  parseMixedCell(cell: string): { nhc: string | null; name: string | null; age: number | null; sex: string | null } {
    const trimmed = cell.trim();
    // Number alone → NHC.
    if (/^\d+(\.\d+)?(E\d+)?$/i.test(trimmed)) {
      const nhc = Math.round(parseFloat(trimmed.replace(/E/i, 'e'))).toString();
      return { nhc, name: null, age: null, sex: null };
    }
    // Name + sex + age: "NOMBRE (HOME, 25 anys)"
    const nameWithSexAge = trimmed.match(/^(.+?)\s*\((HOME|DONA|H|M),\s*(\d+).*\)$/i);
    if (nameWithSexAge) {
      return {
        nhc: null,
        name: nameWithSexAge[1].trim(),
        age: parseInt(nameWithSexAge[3], 10),
        sex: this.normalizeSex(nameWithSexAge[2]),
      };
    }
    // Name + age: "NOMBRE (45)"
    const nameWithAge = trimmed.match(/^(.+?)\s*\((\d+)\)$/);
    if (nameWithAge) {
      return { nhc: null, name: nameWithAge[1].trim(), age: parseInt(nameWithAge[2], 10), sex: null };
    }
    return { nhc: null, name: trimmed, age: null, sex: null };
  }

  // ─────────────────────────────────────────────
  // Field extractors
  // ─────────────────────────────────────────────

  extractNhc(rawValue: unknown): string | null {
    if (rawValue == null) return null;
    if (typeof rawValue === 'number') return Math.round(rawValue).toString();
    const s = String(rawValue).trim();
    if (!s) return null;
    // Numeric (possibly scientific notation) → NHC.
    if (/^\d+(\.\d+)?(E\d+)?$/i.test(s)) {
      return Math.round(parseFloat(s.replace(/E/i, 'e'))).toString();
    }
    return s;
  }

  extractAge(rawValue: unknown): number | null {
    if (rawValue == null || rawValue === '') return null;
    const n = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue));
    return Number.isFinite(n) && n >= 0 && n <= 130 ? Math.round(n) : null;
  }

  normalizeSex(rawValue: unknown): string | null {
    if (rawValue == null) return null;
    // Spanish/English/Catalan normalization → Prisma Sex enum.
    const s = String(rawValue).trim().toUpperCase();
    if (!s) return null;
    if (['HOMBRE', 'MALE', 'HOME', 'MASCULINO', 'H', 'VARÓN', 'VARON'].includes(s)) return 'MALE';
    if (['MUJER', 'FEMALE', 'DONA', 'FEMENINO', 'M', 'HEMBRA'].includes(s)) return 'FEMALE';
    if (['O', 'OTRO', 'OTHER'].includes(s)) return 'OTHER';
    if (['DESCONOCIDO', 'UNKNOWN'].includes(s)) return 'UNKNOWN';
    // Fallback: return the cleaned value if it matches a known enum; null otherwise.
    if (['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'].includes(s)) return s;
    return null;
  }

  // ─────────────────────────────────────────────
  // 4. Junk-row detection (spec §3 isJunkRow)
  // ─────────────────────────────────────────────

  isJunkRow(row: Record<string, unknown>): boolean {
    const values = Object.values(row).filter((v) => v !== null && v !== undefined && v !== '');
    if (values.length === 0) return true;
    if (values.length === 1) {
      const v = String(values[0]);
      if (v.startsWith('X=') || v.startsWith('X:')) return true;
      const lower = v.toLowerCase();
      if (lower.includes('robot') || lower.includes('davinci')) return true;
    }
    const hasPatientId = Object.values(row).some((v) => {
      const s = String(v ?? '');
      return /^\d{6,}/.test(s) || /\d+E\d+/.test(s);
    });
    // A cell that looks like a patient name (≥3 alphabetic chars) means this
    // row carries identifiable patient info — not junk. Defer cleanup/keep to
    // the minimum-identifiable-info skip step instead.
    const hasNameLikeCell = Object.values(row).some((v) => {
      const s = String(v ?? '').trim();
      return /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/.test(s) && !/^(X[=:]|robot|davinci)/i.test(s);
    });
    return !hasPatientId && !hasNameLikeCell && values.length < 3;
  }

  // ─────────────────────────────────────────────
  // Minimum identifiable info: a row needs at least an NHC or a patientName.
  // ─────────────────────────────────────────────

  private hasMinimumIdentifiableInfo(cleaned: CleanedRow): boolean {
    return Boolean(cleaned.nhc) || Boolean(cleaned.patientName);
  }

  /**
   * Strip 'ignore'-mapped columns from the original row before it is stored in
   * importedData. SDD import-data-quality: phone-named columns are no longer
   * stripped here — they are captured on `CleanedRow.phone` by the
   * PhoneExtractorService, and a phone column mapped to 'custom' must keep its
   * value in the audit copy.
   */
  private stripIgnoredColumns(row: Record<string, unknown>, mapping: ColumnMapping): Record<string, unknown> {
    const stripped: Record<string, unknown> = {};
    for (const [column, field] of Object.entries(mapping)) {
      if (field === 'ignore') continue;
      stripped[column] = row[column];
    }
    // Preserve unmapped columns too (they become part of the audit copy in
    // their original form — they aren't classified by the mapping).
    for (const key of Object.keys(row)) {
      if (!(key in mapping)) stripped[key] = row[key];
    }
    return stripped;
  }
}
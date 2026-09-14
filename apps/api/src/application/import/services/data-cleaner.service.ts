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
import type {
  CellOverrides,
  ColumnMapping,
  IgnoredColumn,
  IgnoredRow,
  ParsedFile,
  PreviewOverrides,
  RowClassification,
} from '@medicore/contracts';
import { PhoneExtractorService } from './phone-extractor.service';
import { FalseRecordDetectorService } from './false-record-detector.service';

export interface CleanedRow {
  rowIndex: number;
  nhc: string | null;
  patientName: string | null;
  birthDate: Date | null;
  age: number | null;
  ageAtImport: unknown | null;
  birthDateEstimated: boolean;
  birthDateReferenceYear: number | null;
  sex: string | null;
  email: string | null;
  idDocument: string | null;
  idDocType: string | null;
  address: string | null;
  bloodType: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  notes: string | null;
  admissionDate: Date | null;
  consultationDate: Date | null;
  diagnosis: string | null;
  diagnosisCodes: string | null;
  procedure: string | null;
  chiefComplaint: string | null;
  currentIllness: string | null;
  physicalExam: string | null;
  assessment: string | null;
  plan: string | null;
  followUpDate: Date | null;
  followUpNotes: string | null;
  surgeryDate: Date | null;
  testType: string | null;          // clinical test/study type (EMG, TAC, etc.)
  requestDate: Date | null;         // when the test was ordered
  completionDate: Date | null;      // when the test was performed
  hospitalStayDays: number | null;  // hospital stay duration in days
  surgeryDurationMinutes: number | null; // surgery duration in minutes
  consultationType?: string | null;
  surgeryStatus?: string | null;
  asa?: string | null;
  anesthesiaType?: string | null;
  technique?: string | null;
  findings?: string | null;
  complications?: string | null;
  postOpNotes?: string | null;
  outcome?: string | null;
  phone: string | null;             // SDD import-data-quality: extracted patient phone
  importedFields: Record<string, unknown>; // mapped standard source values for provenance
  customFields: Record<string, unknown>;   // custom column values, keyed by custom-field name
  raw: Record<string, unknown>;             // original row preserved for audit/importedData
}

export interface CleanResult {
  cleanedRows: CleanedRow[];
  junkRowIndices: number[];
  skippedRowIndices: number[];   // rows pending because no identifiable patient info
  falseRecordRowIndices: number[]; // SDD import-data-quality: rows flagged as false records
  discardedRowIndices: number[];
  reasons: Array<{ rowIndex: number; reason: string }>;
  fullIdentityRows: RowClassification[];
  identityLightRows: RowClassification[];
  unidentifiableRows: RowClassification[];
}

export interface CleanOverrides {
  previewOverrides?: PreviewOverrides;
  ignoredColumns?: IgnoredColumn[];
  ignoredRows?: IgnoredRow[];
  cellOverrides?: CellOverrides;
  /** Stable batch creation date used for age-based DOB estimation. */
  referenceDate?: Date;
}

// Excel serial epoch + Lotus 1-2-3 leap year bug: 25569 = days between
// 1900-01-01 (Excel's buggy epoch) and 1970-01-01 (Unix epoch).
const EXCEL_SERIAL_EPOCH_OFFSET = 25569;
const SECONDS_PER_DAY = 86400;
const EXCEL_SERIAL_MIN = 59;    // ~1900-03-01
const EXCEL_SERIAL_MAX = 80000; // ~2118
const PLACEHOLDER_BIRTH_YEAR = 1900;

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
  clean(file: ParsedFile, mapping: ColumnMapping, overrides: CleanOverrides = {}): CleanResult {
    const cleanedRows: CleanedRow[] = [];
    const junkRowIndices: number[] = [];
    const skippedRowIndices: number[] = [];
    const falseRecordRowIndices: number[] = [];
    const discardedRowIndices: number[] = [];
    const reasons: CleanResult['reasons'] = [];
    const fullIdentityRows: RowClassification[] = [];
    const identityLightRows: RowClassification[] = [];
    const unidentifiableRows: RowClassification[] = [];
    const ignoredColumns = new Set((overrides.ignoredColumns ?? []).map(({ column }) => column));
    const ignoredRows = new Map((overrides.ignoredRows ?? []).map((entry) => [entry.rowIndex, entry.reason]));

    file.rows.forEach((row, rowIndex) => {
      if (ignoredRows.has(rowIndex)) {
        discardedRowIndices.push(rowIndex);
        reasons.push({ rowIndex, reason: `discarded by physician${ignoredRows.get(rowIndex) ? `: ${ignoredRows.get(rowIndex)}` : ''}` });
        return;
      }
      // Explicit discard wins before junk detection, field mapping, and audit
      // storage. Preview edits then win over the raw value for each cell.
      const effectiveRow = this.applyOverrides(row, rowIndex, overrides, ignoredColumns);

      // 4. Junk row detection (totals, means, notes, single-cell metadata).
      if (this.isJunkRow(effectiveRow)) {
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
        ageAtImport: null,
        birthDateEstimated: false,
        birthDateReferenceYear: null,
        sex: null,
        email: null,
        idDocument: null,
        idDocType: null,
        address: null,
        bloodType: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        emergencyContactRelationship: null,
        notes: null,
        admissionDate: null,
        consultationDate: null,
        diagnosis: null,
        diagnosisCodes: null,
        procedure: null,
        chiefComplaint: null,
        currentIllness: null,
        physicalExam: null,
        assessment: null,
        plan: null,
        followUpDate: null,
        followUpNotes: null,
        surgeryDate: null,
        testType: null,
        requestDate: null,
        completionDate: null,
        hospitalStayDays: null,
        surgeryDurationMinutes: null,
        consultationType: null,
        surgeryStatus: null,
        asa: null,
        anesthesiaType: null,
        technique: null,
        findings: null,
        complications: null,
        postOpNotes: null,
        outcome: null,
        phone: null,
        importedFields: {},
        customFields: {},
        // raw preserves the original row for importedData JSONB (BR-IMP-002),
        // but BR-IMP-007 phone/ignored columns are stripped here so they never
        // reach Patient.importedData downstream.
        raw: this.stripIgnoredColumns(effectiveRow, mapping),
      };

      // Walk every mapped column; assign to the standard field or customFields.
      for (const [column, field] of Object.entries(mapping)) {
        // 5. 'ignore'-mapped columns never enter the field walk. Phone-named
        //    columns are NO LONGER dropped here (SDD import-data-quality): they
        //    flow through to the PhoneExtractorService which scans the full row.
        if (field === 'ignore') continue;

        const rawValue = effectiveRow[column];

        if (field !== 'custom') {
          const sourceValue = this.normalizeImportedSourceValue(rawValue);
          if (sourceValue !== null) cleaned.importedFields[field] = sourceValue;
        }

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
              if (valueForName.age !== null) {
                cleaned.age = valueForName.age;
                cleaned.ageAtImport = rawValue;
              }
              if (valueForName.sex) cleaned.sex = valueForName.sex;
            } else {
              const v = this.normalizeDisplayText(rawValue);
              if (v !== null) cleaned.patientName = v;
            }
            break;
          }
          case 'birthDate': {
            const v = this.parseDate(rawValue);
            if (v !== null && !this.isPlaceholderBirthDate(v)) cleaned.birthDate = v;
            break;
          }
          case 'age': {
            const v = this.extractAge(rawValue);
            // Only overwrite an age parsed earlier from a mixed name/sex cell
            // when the dedicated age column actually has a value.
            if (v !== null) {
              cleaned.age = v;
              cleaned.ageAtImport = rawValue;
            }
            break;
          }
          case 'sex': {
            const v = this.normalizeSex(rawValue);
            if (v !== null) cleaned.sex = v;
            break;
          }
          case 'phone': {
            cleaned.phone = this.extractExplicitPhone(rawValue);
            break;
          }
          case 'email': {
            cleaned.email = this.normalizeDisplayText(rawValue);
            break;
          }
          case 'idDocument': {
            cleaned.idDocument = this.normalizeDisplayText(rawValue);
            break;
          }
          case 'idDocType': {
            cleaned.idDocType = this.normalizeIdDocType(rawValue);
            break;
          }
          case 'address': {
            cleaned.address = this.normalizeDisplayText(rawValue);
            break;
          }
          case 'bloodType': {
            cleaned.bloodType = this.normalizeBloodType(rawValue);
            break;
          }
          case 'emergencyContactName': {
            cleaned.emergencyContactName = this.normalizeDisplayText(rawValue);
            break;
          }
          case 'emergencyContactPhone': {
            cleaned.emergencyContactPhone = this.extractExplicitPhone(rawValue);
            break;
          }
          case 'emergencyContactRelationship': {
            cleaned.emergencyContactRelationship = this.normalizeDisplayText(rawValue);
            break;
          }
          case 'notes': {
            cleaned.notes = this.normalizeDisplayText(rawValue);
            break;
          }
          case 'admissionDate': {
            const v = this.parseDate(rawValue);
            if (v !== null) cleaned.admissionDate = v;
            break;
          }
          case 'consultationDate': {
            const v = this.parseDate(rawValue);
            if (v !== null) cleaned.consultationDate = v;
            break;
          }
          case 'diagnosis': {
            const v = this.normalizeDisplayText(rawValue);
            if (v !== null) cleaned.diagnosis = v;
            break;
          }
          case 'diagnosisCodes': {
            const v = this.normalizeDisplayText(rawValue);
            if (v !== null) cleaned.diagnosisCodes = v;
            break;
          }
          case 'procedure': {
            const v = this.normalizeDisplayText(rawValue);
            if (v !== null) cleaned.procedure = v;
            break;
          }
          case 'chiefComplaint': {
            const v = this.normalizeDisplayText(rawValue);
            if (v !== null) cleaned.chiefComplaint = v;
            break;
          }
          case 'currentIllness': {
            const v = this.normalizeDisplayText(rawValue);
            if (v !== null) cleaned.currentIllness = v;
            break;
          }
          case 'physicalExam': {
            const v = this.normalizeDisplayText(rawValue);
            if (v !== null) cleaned.physicalExam = v;
            break;
          }
          case 'assessment': {
            const v = this.normalizeDisplayText(rawValue);
            if (v !== null) cleaned.assessment = v;
            break;
          }
          case 'plan': {
            const v = this.normalizeDisplayText(rawValue);
            if (v !== null) cleaned.plan = v;
            break;
          }
          case 'followUpDate': {
            const v = this.parseDate(rawValue);
            if (v !== null) cleaned.followUpDate = v;
            break;
          }
          case 'followUpNotes': {
            const v = this.normalizeDisplayText(rawValue);
            if (v !== null) cleaned.followUpNotes = v;
            break;
          }
          case 'surgeryDate': {
            const v = this.parseDate(rawValue);
            if (v !== null) cleaned.surgeryDate = v;
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
          case 'hospitalStayDays': {
            const v = this.parseNumericValue(rawValue, /d[ií]as?|days?/i, 0);
            if (v !== null) cleaned.hospitalStayDays = v;
            break;
          }
          case 'surgeryDurationMinutes': {
            const v = this.parseNumericValue(rawValue, /min(?:utos?)?|minutes?/i, 1, true);
            if (v !== null) cleaned.surgeryDurationMinutes = v;
            break;
          }
          case 'consultationType': {
            const v = this.normalizeConsultationType(rawValue);
            if (v !== null) cleaned.consultationType = v;
            break;
          }
          case 'surgeryStatus': {
            const v = this.normalizeSurgeryStatus(rawValue);
            if (v !== null) cleaned.surgeryStatus = v;
            break;
          }
          case 'asa': {
            const v = this.normalizeAsa(rawValue);
            if (v !== null) cleaned.asa = v;
            break;
          }
          case 'anesthesiaType': {
            const v = this.normalizeDisplayText(rawValue);
            if (v !== null) cleaned.anesthesiaType = v;
            break;
          }
          case 'technique': {
            const v = this.normalizeDisplayText(rawValue);
            if (v !== null) cleaned.technique = v;
            break;
          }
          case 'findings': {
            const v = this.normalizeDisplayText(rawValue);
            if (v !== null) cleaned.findings = v;
            break;
          }
          case 'complications': {
            const v = this.normalizeDisplayText(rawValue);
            if (v !== null) cleaned.complications = v;
            break;
          }
          case 'postOpNotes': {
            const v = this.normalizeDisplayText(rawValue);
            if (v !== null) cleaned.postOpNotes = v;
            break;
          }
          case 'outcome': {
            const v = this.normalizeDisplayText(rawValue);
            if (v !== null) cleaned.outcome = v;
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
        for (const val of Object.values(effectiveRow)) {
          if (typeof val === 'string' && /\(.*\)/.test(val)) {
            const parsed = this.parseMixedCell(val);
            if (parsed.name) cleaned.patientName = parsed.name;
            if (parsed.age !== null && cleaned.age === null) {
              cleaned.age = parsed.age;
              cleaned.ageAtImport = val;
            }
            if (parsed.nhc) cleaned.nhc = parsed.nhc;
            break;
          }
        }
      }

      // SDD import-data-quality: extract the patient phone from the FULL
      // original row (scans every cell, regardless of the column mapping).
      cleaned.phone = cleaned.phone ?? this.phoneExtractor.extract(effectiveRow);

      if (cleaned.age !== null && !cleaned.birthDate && overrides.referenceDate) {
        const referenceYear = overrides.referenceDate.getUTCFullYear();
        const estimatedYear = referenceYear - Math.trunc(cleaned.age);
        const estimated = this.parseCalendarDate(estimatedYear, 1, 1);
        if (estimated && !this.isPlaceholderBirthDate(estimated)) {
          cleaned.birthDate = estimated;
          cleaned.birthDateEstimated = true;
          cleaned.birthDateReferenceYear = referenceYear;
        }
      }

      // SDD import-data-quality: validate cleaned cells against their mapped
      // column expectations and flag false records (equipment names, admin
      // notes, numeric record-id cells, ...).
      const detection = this.falseRecordDetector.detect(effectiveRow, this.toDetectorColumnMap(mapping));
      if (detection.isFalse) {
        falseRecordRowIndices.push(rowIndex);
        reasons.push({ rowIndex, reason: `false record: ${detection.reasons.join('; ')}` });
        return;
      }

      // Every eligible non-junk row remains visible in exactly one identity bucket.
      if (!cleaned.patientName && !cleaned.nhc) {
        skippedRowIndices.push(rowIndex);
        unidentifiableRows.push({ rowIndex, reason: 'pending_decision' });
        reasons.push({ rowIndex, reason: 'pending decision: no name or NHC' });
        return;
      }

      if (cleaned.patientName) {
        fullIdentityRows.push({ rowIndex });
      } else {
        identityLightRows.push({ rowIndex, reason: 'NHC only' });
      }
      cleanedRows.push(cleaned);
    });

    return {
      cleanedRows,
      junkRowIndices,
      skippedRowIndices,
      falseRecordRowIndices,
      discardedRowIndices,
      reasons,
      fullIdentityRows,
      identityLightRows,
      unidentifiableRows,
    };
  }

  private applyOverrides(
    row: Record<string, unknown>,
    rowIndex: number,
    overrides: CleanOverrides,
    ignoredColumns: Set<string>,
  ): Record<string, unknown> {
    const preview = overrides.previewOverrides?.[String(rowIndex)] ?? {};
    const cells = overrides.cellOverrides?.[String(rowIndex)] ?? {};
    const result: Record<string, unknown> = {};

    for (const [column, rawValue] of Object.entries(row)) {
      if (ignoredColumns.has(column)) continue;
      if (Object.prototype.hasOwnProperty.call(cells, column)) {
        result[column] = null;
      } else if (Object.prototype.hasOwnProperty.call(preview, column)) {
        result[column] = preview[column];
      } else {
        result[column] = rawValue;
      }
    }
    return result;
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
      if (value !== 60 && value >= EXCEL_SERIAL_MIN && value <= EXCEL_SERIAL_MAX) {
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
        if (n !== 60 && n >= EXCEL_SERIAL_MIN && n <= EXCEL_SERIAL_MAX) {
          return this.convertExcelSerial(n);
        }
      }
      // Explicit date formats only. Day-first values use a fixed two-digit
      // year policy so imports do not change meaning as the calendar advances.
      const dayFirst = trimmed.match(/^(\d{1,2})([/.\-])(\d{1,2})\2(\d{2}|\d{4})$/);
      if (dayFirst) {
        const day = parseInt(dayFirst[1], 10);
        const month = parseInt(dayFirst[3], 10);
        const yearRaw = dayFirst[4];
        const year = yearRaw.length === 2
          ? this.expandTwoDigitYear(parseInt(yearRaw, 10))
          : parseInt(yearRaw, 10);
        return this.parseCalendarDate(year, month, day);
      }
      // ISO: yyyy-mm-dd
      const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (iso) {
        return this.parseCalendarDate(parseInt(iso[1], 10), parseInt(iso[2], 10), parseInt(iso[3], 10));
      }
      return null;
    }
    return null;
  }

  /**
   * Expand a two-digit year using the import policy: 00–49 means 2000–2049
   * and 50–99 means 1950–1999.
   */
  private expandTwoDigitYear(twoDigit: number): number {
    return twoDigit <= 49 ? 2000 + twoDigit : 1900 + twoDigit;
  }

  /** Build a date only when its components survive a calendar round-trip. */
  private parseCalendarDate(year: number, month: number, day: number): Date | null {
    const date = this.utcDate(year, month - 1, day);
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day
      ? date
      : null;
  }

  /** Build a Date at UTC midnight from year/month(0-based)/day — timezone-stable. */
  private utcDate(year: number, monthIndex: number, day: number): Date {
    return new Date(Date.UTC(year, monthIndex, day));
  }

  /** spec §3: serial 46023 → 2026-01-15. Formula: (serial - 25569) * 86400 * 1000. */
  convertExcelSerial(serial: number): Date {
    return new Date((serial - EXCEL_SERIAL_EPOCH_OFFSET) * SECONDS_PER_DAY * 1000);
  }

  private isPlaceholderBirthDate(value: Date): boolean {
    return value.getUTCFullYear() === PLACEHOLDER_BIRTH_YEAR;
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
    const normalized = typeof rawValue === 'number'
      ? String(rawValue)
      : String(rawValue).trim().replace(',', '.');
    const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:años?|anys?)?$/i);
    if (!match) return null;
    const n = Number(match[1]);
    return Number.isFinite(n) && n >= 0 && n <= 130 ? n : null;
  }

  /** Parse a non-negative number with an optional unit suffix. */
  private parseNumericValue(
    rawValue: unknown,
    unit: RegExp,
    minimum: number,
    integer = false,
  ): number | null {
    if (rawValue == null || rawValue === '') return null;
    const normalized = String(rawValue).trim().replace(',', '.');
    const match = normalized.match(new RegExp(`^([+]?\\d+(?:\\.\\d+)?)\\s*(?:${unit.source})?$`, 'i'));
    if (!match) return null;
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value < minimum || (integer && !Number.isInteger(value))) return null;
    return value;
  }

  normalizeSex(rawValue: unknown): string | null {
    if (rawValue == null) return null;
    // Spanish/English/Catalan normalization → Prisma Sex enum.
    const s = String(rawValue).trim().toUpperCase();
    if (!s) return null;
    if (['HOMBRE', 'MALE', 'HOME', 'MASCULINO', 'H', 'VARÓN', 'VARON'].includes(s)) return 'MALE';
    if (['MUJER', 'FEMALE', 'DONA', 'FEM', 'FEMENINO', 'F', 'M', 'HEMBRA'].includes(s)) return 'FEMALE';
    if (['O', 'OTRO', 'OTHER'].includes(s)) return 'OTHER';
    if (['DESCONOCIDO', 'UNKNOWN'].includes(s)) return 'UNKNOWN';
    // Fallback: return the cleaned value if it matches a known enum; null otherwise.
    if (['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'].includes(s)) return s;
    return null;
  }

  normalizeBloodType(rawValue: unknown): string | null {
    const value = this.normalizeMatchable(rawValue)?.replace(/\s+/g, '');
    if (!value) return null;
    const aliases: Record<string, string> = {
      'a+': 'A_POS', 'a-': 'A_NEG', 'b+': 'B_POS', 'b-': 'B_NEG',
      'ab+': 'AB_POS', 'ab-': 'AB_NEG', 'o+': 'O_POS', 'o-': 'O_NEG',
      'a_pos': 'A_POS', 'a_neg': 'A_NEG', 'b_pos': 'B_POS', 'b_neg': 'B_NEG',
      'ab_pos': 'AB_POS', 'ab_neg': 'AB_NEG', 'o_pos': 'O_POS', 'o_neg': 'O_NEG',
      'unknown': 'UNKNOWN', 'desconocido': 'UNKNOWN',
    };
    return aliases[value.replace('rh', '')] ?? null;
  }

  normalizeIdDocType(rawValue: unknown): string | null {
    const value = this.normalizeMatchable(rawValue)?.replace(/[.\s-]/g, '');
    if (!value) return null;
    if (['dni', 'nif'].includes(value)) return 'DNI';
    if (value === 'nie') return 'NIE';
    if (['passport', 'pasaporte'].includes(value)) return 'PASSPORT';
    if (['other', 'otro'].includes(value)) return 'OTHER';
    return null;
  }

  private normalizeConsultationType(rawValue: unknown): string | null {
    const value = this.normalizeMatchable(rawValue)?.toUpperCase().replace(/[\s-]+/g, '_');
    const aliases: Record<string, string> = {
      FIRST_VISIT: 'FIRST_VISIT', PRIMERA_VISITA: 'FIRST_VISIT', PRIMERA_CONSULTA: 'FIRST_VISIT',
      FOLLOW_UP: 'FOLLOW_UP', SEGUIMIENTO: 'FOLLOW_UP', REVISION: 'FOLLOW_UP', REVISIÓN: 'FOLLOW_UP',
      URGENCY: 'URGENCY', URGENCIA: 'URGENCY', URGENCIAS: 'URGENCY',
      POST_OP: 'POST_OP', POSTOP: 'POST_OP', POSTOPERATORIO: 'POST_OP',
      TELECONSULTATION: 'TELECONSULTATION', TELECONSULTA: 'TELECONSULTATION',
    };
    return value ? aliases[value] ?? null : null;
  }

  private normalizeSurgeryStatus(rawValue: unknown): string | null {
    const value = this.normalizeMatchable(rawValue)?.toUpperCase().replace(/[\s-]+/g, '_');
    const aliases: Record<string, string> = {
      SCHEDULED: 'SCHEDULED', PROGRAMADA: 'SCHEDULED', PROGRAMADO: 'SCHEDULED',
      COMPLETED: 'COMPLETED', COMPLETADA: 'COMPLETED', REALIZADA: 'COMPLETED', REALIZADO: 'COMPLETED',
      CANCELLED: 'CANCELLED', CANCELED: 'CANCELLED', CANCELADA: 'CANCELLED', CANCELADO: 'CANCELLED',
      POSTPONED: 'POSTPONED', APLAZADA: 'POSTPONED', APLAZADO: 'POSTPONED', POSPUESTA: 'POSTPONED', POSPUESTO: 'POSTPONED',
    };
    return value ? aliases[value] ?? null : null;
  }

  private normalizeAsa(rawValue: unknown): string | null {
    const value = this.normalizeMatchable(rawValue)?.toUpperCase().replace(/[\s-]+/g, '_');
    if (!value) return null;
    const match = value.match(/^(?:ASA_?)?([1-6]|I{1,3}|IV|V|VI)$/);
    if (!match) return null;
    const normalized = match[1];
    const roman: Record<string, string> = { I: 'I', II: 'II', III: 'III', IV: 'IV', V: 'V', VI: 'VI' };
    return `ASA_${roman[normalized] ?? ['I', 'II', 'III', 'IV', 'V', 'VI'][Number(normalized) - 1]}`;
  }

  private extractExplicitPhone(rawValue: unknown): string | null {
    const text = this.normalizeDisplayText(rawValue);
    if (!text) return null;
    return this.phoneExtractor.extract({ phone: text }) ?? text;
  }

  private normalizeImportedSourceValue(value: unknown): unknown | null {
    if (value == null || value === '') return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value.trim() || null;
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    return String(value);
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
      if (!(column in row)) continue;
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

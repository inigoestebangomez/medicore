// apps/api/src/infrastructure/ai/structured-analysis/heuristic-analyzer.provider.ts
// Pure regex/fuzzy/statistical analyzer — no external API calls, instant and free.
// Handles ~80% of Spanish hospital Excel files: column-name matching against
// known MediCore fields, Excel date-serial detection, numeric-range typing and
// phone-like column exclusion (BR-IMP-007). Confidence ≥ 0.7 for standard
// Spanish hospital column names. Failures fall through to Groq / Claude.
//
// Excel date serials count from 1900-01-01 and include the Lotus 1-2-3 leap
// year bug. We use the standard epoch conversion:
// (serial - 25569) * 86400 * 1000 ms. Serial 46023 = 2026-01-01.

import { Injectable } from '@nestjs/common';
import type {
  ColumnMappingProposal,
  ColumnMapping,
  FileSample,
  StandardField,
} from '@medicore/contracts';
import type { StructuredAnalysisProvider } from './structured-analysis.provider';

// Known MediCore standard fields and the regex patterns that suggest them.
// Patterns are matched against a normalized column name (lowercase, NFD,
// diacritics stripped, trimmed). Order matters — more specific patterns first.
interface FieldPattern {
  field: StandardField;
  patterns: RegExp[];
}

const FIELD_PATTERNS: FieldPattern[] = [
  // NHC — most identifying (don't confuse with "nº consentimiento" etc.)
  { field: 'nhc', patterns: [/nhc/, /n[º°o]?\s*hist/, /historia/, /n[º°o]?\s*clinica/, /nucleo/] },
  // patientName
  { field: 'patientName', patterns: [/nombre.*paciente/, /paciente/, /^nombre$/, /nombre.*completo/, /ap.*llido/, /name/] },
  // birthDate
  { field: 'birthDate', patterns: [/fecha.*nacimiento/, /f\.?\s*nac\.?/, /nacimiento/, /fnac/, /dob/, /birth/] },
  // age
  { field: 'age', patterns: [/^edad$/, /\bedad\b/] },
  // sex
  { field: 'sex', patterns: [/^sexo$/, /\bsexo\b/, /genero/, /g[eé]nero/, /gender/] },
  // admissionDate — common in hospital surgical exports
  { field: 'admissionDate', patterns: [/fecha.*ingr/, /fecha.*intervenci/, /fecha.*iq/, /fecha.*quir/, /f\.?\s*iq/, /fecha.*cirug/, /admission/] },
  // diagnosis
  { field: 'diagnosis', patterns: [/diagn.*stico/, /sospecha/, /^dx$/, /\bdx\b/, /diagnost/] },
  // procedure
  { field: 'procedure', patterns: [/procedimiento/, /intervenci/, /\biq\b/, /t[eé]cnica.*quir/, /cirug/, /procedure/] },
];

// Phone-like columns — always mapped to 'ignore' (BR-IMP-007)
const PHONE_PATTERNS: RegExp[] = [
  /tel[eé]fono/, /\btlf\b/, /tel[eé]f/, /\bm[oó]vil\b/, /\bmvl\b/, /\bphone\b/, /tlfno/, /contacto.*tel/, /\bcel\b/,
];

const EXCEL_SERIAL_MIN = 59;    // ~1900-03-01 — pre-1900 records are clinically irrelevant
const EXCEL_SERIAL_MAX = 80000; // ~2118 — plausible birth/admission bounds

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whether a cell value looks like an Excel date serial (numeric, in plausible date range). */
function looksLikeExcelSerial(value: unknown): boolean {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= EXCEL_SERIAL_MIN && value <= EXCEL_SERIAL_MAX;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const n = parseFloat(trimmed);
      return Number.isFinite(n) && n >= EXCEL_SERIAL_MIN && n <= EXCEL_SERIAL_MAX;
    }
    // Scientific notation like "1.8685362E7" indicates an NHC, not a date serial.
  }
  return false;
}

/**
 * Detect "X=2,4" / "X: 112" / "robot daVinci Xi." junk rows. Identical logic to
 * DataCleanerService.isJunkRow — kept duplicated intentionally so the heuristic
 * analyzer can flag junk rows without depending on the cleaning service
 * (keeps the StructuredAnalysisProvider chain deployment-light).
 */
function isJunkRow(row: Record<string, unknown>): boolean {
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
  return !hasPatientId && values.length < 3;
}

@Injectable()
export class HeuristicAnalyzer implements StructuredAnalysisProvider {
  readonly name = 'heuristic' as const;
  readonly modelName = 'regex-heuristic-v1';

  async analyzeStructure(sample: FileSample): Promise<ColumnMappingProposal> {
    const mapping: ColumnMapping = {};
    const issues: string[] = [];
    let standardHits = 0;
    let totalTypedColumns = 0;   // standard or ignore
    let unmappedColumns = 0;

    for (const col of sample.columns) {
      const norm = normalizeName(col);

      // BR-IMP-007: phone columns are ALWAYS excluded first.
      if (PHONE_PATTERNS.some((re) => re.test(norm))) {
        mapping[col] = 'ignore';
        totalTypedColumns++;
        continue;
      }

      const match = FIELD_PATTERNS.find((p) => p.patterns.some((re) => re.test(norm)));
      if (match) {
        mapping[col] = match.field;
        standardHits++;
        totalTypedColumns++;
      } else {
        // Try sample-based typing: if most cells are Excel date serials, suggest birthDate.
        const dateSerials = sample.rows
          .map((r) => r[col])
          .filter((v) => v !== null && v !== undefined && v !== '');
        if (dateSerials.length > 0) {
          const serialRatio = dateSerials.filter(looksLikeExcelSerial).length / dateSerials.length;
          if (serialRatio >= 0.6) {
            mapping[col] = 'birthDate';
            standardHits++;
            totalTypedColumns++;
            continue;
          }
        }

        // Unmapped → custom field (the physician can rename it in the UI).
        mapping[col] = 'custom';
        unmappedColumns++;
      }
    }

    // Detect junk rows in the sample (heuristic; full detection runs in DataCleaner).
    const junkRowIndices = sample.rows
      .map((row, idx) => (isJunkRow(row) ? idx : -1))
      .filter((idx) => idx >= 0);

    const confidence = this.computeConfidence({
      columns: sample.columns.length,
      standardHits,
      unmappedColumns,
    });

    if (confidence < 0.7) {
      issues.push(
        `Heuristic confidence ${confidence.toFixed(2)} below threshold — several columns lack a clear standard match.`,
      );
    }
    if (unmappedColumns > 0) {
      issues.push(`${unmappedColumns} column(s) auto-classified as custom fields; review the mapping.`);
    }

    const notes =
      standardHits >= sample.columns.length
        ? `Matched all ${sample.columns.length} column(s) via regex heuristics.`
        : `Matched ${standardHits}/${sample.columns.length} column(s); ${unmappedColumns} left as custom.`;

    return {
      columnMapping: mapping,
      customFieldNames: {},
      junkRowIndices,
      issues,
      confidence,
      notes,
      provider: 'heuristic',
    };
  }

  /**
   * Confidence heuristic.
   * - Each standard hit raises confidence; each unmapped column lowers it.
   * - A fully-matched file lands around 0.95 — comfortably above the 0.7 chain
   *   threshold so Groq/Claude are skipped entirely for clean files.
   * - Floor at 0 so the orchestrator cleanly falls through to AI providers.
   */
  private computeConfidence(input: { columns: number; standardHits: number; unmappedColumns: number }): number {
    const total = Math.max(1, input.columns);
    const hitRatio = input.standardHits / total;
    const unmappedRatio = input.unmappedColumns / total;
    // Combine a positive bias from standard hits and a penalty for ambiguity.
    const raw = 0.55 + 0.45 * hitRatio - 0.4 * unmappedRatio;
    return Math.max(0, Math.min(0.95, Number(raw.toFixed(2))));
  }
}
// apps/api/src/application/import/services/false-record-detector.service.ts
// Column-aware validation that a cleaned cell's content matches the data type
// its mapped column expects (SDD import-data-quality). Reuses DataCleanerService
// helpers (parseDate, normalizeSex) so the detector stays aligned with the same
// parsing logic used to build the cleaned row.
//
// NHC rule is gated behind `nhcRuleActive` (default OFF, SDD T-10): it must be
// validated against a real import batch before it can flag any row. The rule is
// fully implemented and tested in both modes so activation is a one-line flip.

import { Injectable } from '@nestjs/common';
import { DataCleanerService } from './data-cleaner.service';

// Brand / equipment keywords that have no place in a person-name cell.
const NAME_BRAND_KEYWORDS = [
  'davinci', 'robot', 'xi', 'endoscope', 'olympus', 'storz',
  'medtronic', 'stryker', 'siemens', 'philips', 'ge',
];

// Admin / clinical-note keywords indicating the cell is notes, not a name.
const NAME_ADMIN_KEYWORDS = [
  'pendiente', 'revision', 'revisar', 'no sabe', 'consulta',
  'cita', 'quirofano', 'box',
];

// A name shaped like a pure numeric / hyphen / separator id (record-id cell).
const NUMERIC_ID_PATTERN = /^[\d\s\-+.]+$/;

export interface DetectionResult {
  isFalse: boolean;
  reasons: string[];
}

@Injectable()
export class FalseRecordDetectorService {
  /**
   * `nhcRuleActive` gates the NHC-column false-record rule. It is OFF by
   * default (SDD import-data-quality T-10): the rule must be validated against
   * a real import batch before it can flag rows. Flip the default to true once
   * a batch clears validation with no legitimate NHCs flagged.
   */
  constructor(
    private readonly cleaner: DataCleanerService = new DataCleanerService(),
    private readonly nhcRuleActive = false,
  ) {}

  /**
   * Validate the cleaned cells against their mapped column expectations.
   * `cleaned` is keyed by column index; `columnMap` maps column index → field
   * name (name | age | birthDate | sex | nhc).
   */
  detect(
    cleaned: Record<string, unknown>,
    columnMap: Map<string, string>,
  ): DetectionResult {
    const reasons: string[] = [];

    for (const [columnIndex, fieldName] of columnMap) {
      const value = cleaned[columnIndex];
      const reason = this.validateColumn(value, fieldName);
      if (reason) reasons.push(reason);
    }

    return { isFalse: reasons.length > 0, reasons };
  }

  private validateColumn(value: unknown, fieldName: string): string | null {
    switch (fieldName) {
      case 'name':
        return this.validateName(value);
      case 'age':
        return this.validateAge(value);
      case 'birthDate':
        return this.validateBirthDate(value);
      case 'sex':
        return this.validateSex(value);
      case 'nhc':
        return this.validateNhc(value);
      default:
        return null;
    }
  }

  /**
   * NHC-column rule (T-10, gated): a stored/mapped NHC that is textual (≥4
   * letters and does not start with a digit) is treated as a false record —
   * genuine hospital NHCs are numeric (13046043) and MediCore NHCs start with a
   * 4-digit year (2026-00012), neither of which this rule flags.
   */
  private validateNhc(value: unknown): string | null {
    if (!this.nhcRuleActive) return null; // test-first mode until a real batch is validated
    if (this.isEmpty(value)) return null;
    const raw = String(value).trim();
    const letters = (raw.match(/[A-Za-zÁÉÍÓÚÜáéíóúüÑñ]/g) ?? []).length;
    if (letters >= 4 && !/^\d/.test(raw)) {
      return 'nhc: textual identifier, not a patient NHC';
    }
    return null;
  }

  private isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    return String(value).trim() === '';
  }

  /** Lowercase + diacritic-stripped form for accent-insensitive matching. */
  private normalizeText(value: unknown): string {
    return String(value)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private hasKeyword(keywords: string[], text: string): boolean {
    return keywords.some((kw) => {
      const pattern = new RegExp(`\\b${kw.replace(/\s+/g, '\\s+')}\\b`);
      return pattern.test(text);
    });
  }

  private validateName(value: unknown): string | null {
    if (this.isEmpty(value)) return null;
    const raw = String(value).trim();

    if (raw.length === 1) return 'name: single-character name';
    if (NUMERIC_ID_PATTERN.test(raw)) return 'name: numeric value, not a person name';

    const normalized = this.normalizeText(raw);
    if (this.hasKeyword(NAME_BRAND_KEYWORDS, normalized)) {
      return 'name: equipment/brand keyword detected';
    }
    if (this.hasKeyword(NAME_ADMIN_KEYWORDS, normalized)) {
      return 'name: admin/clinical note keyword detected';
    }
    return null;
  }

  private validateAge(value: unknown): string | null {
    if (this.isEmpty(value)) return null;
    const n = Number(value);
    if (isNaN(n) || n < 0 || n > 130) {
      return 'age: non-numeric or out-of-range value';
    }
    return null;
  }

  private validateBirthDate(value: unknown): string | null {
    if (this.isEmpty(value)) return null;
    if (this.cleaner.parseDate(value) === null) return 'birthDate: invalid date';
    return null;
  }

  private validateSex(value: unknown): string | null {
    if (this.isEmpty(value)) return null;
    if (this.cleaner.normalizeSex(value) === null) {
      return 'sex: unrecognized sex value';
    }
    return null;
  }
}
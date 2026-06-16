// apps/api/src/domain/patient/value-objects/nhc.vo.ts
// NHC (Número de Historia Clínica) Value Object
// Internal format: YYYY-NNNNN (e.g., 2026-00001) — BR-PAT-001
// External format: alphanumeric string (e.g., EXT-2024-001) — BR-PAT-004

export class NHC {
  // Internal format: YYYY-NNNNN
  static readonly INTERNAL_PATTERN = /^\d{4}-\d{5}$/;
  // External format: 3-20 chars, uppercase letters, numbers, hyphens
  static readonly EXTERNAL_PATTERN = /^[A-Z0-9]{3,20}(-[A-Z0-9]+)*$/;

  readonly value: string;
  readonly isExternal: boolean;

  private constructor(value: string, isExternal: boolean) {
    this.value = value;
    this.isExternal = isExternal;
  }

  /**
   * Generate an internal NHC from year and sequence number.
   * Format: YYYY-NNNNN (5-digit zero-padded sequence)
   */
  static generate(year: number, sequence: number): NHC {
    if (year < 1000 || year > 9999) {
      throw new Error(`Invalid year for NHC: ${year}`);
    }
    if (sequence < 1 || sequence > 99999) {
      throw new Error(`Invalid sequence for NHC: ${sequence}`);
    }
    return new NHC(`${year}-${String(sequence).padStart(5, '0')}`, false);
  }

  /**
   * Parse and validate an NHC string.
   * Accepts both internal (YYYY-NNNNN) and external (alphanumeric) formats.
   */
  static parse(value: string): NHC {
    if (NHC.INTERNAL_PATTERN.test(value)) {
      return new NHC(value, false);
    }
    if (NHC.EXTERNAL_PATTERN.test(value)) {
      return new NHC(value, true);
    }
    throw new Error(
      `Invalid NHC format: "${value}". Expected YYYY-NNNNN (e.g., 2026-00001) or external alphanumeric (3-20 chars)`,
    );
  }

  /**
   * Check if a string is a valid NHC (internal or external format).
   */
  static isValid(value: string): boolean {
    return NHC.INTERNAL_PATTERN.test(value) || NHC.EXTERNAL_PATTERN.test(value);
  }

  /** Extract the year component from an internal NHC */
  get year(): number {
    if (this.isExternal) {
      throw new Error('Cannot extract year from external NHC');
    }
    return parseInt(this.value.substring(0, 4), 10);
  }

  /** Extract the sequence number from an internal NHC */
  get sequence(): number {
    if (this.isExternal) {
      throw new Error('Cannot extract sequence from external NHC');
    }
    return parseInt(this.value.substring(5), 10);
  }

  toString(): string {
    return this.value;
  }
}
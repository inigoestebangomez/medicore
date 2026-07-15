// apps/api/src/domain/import/column-mapping.vo.ts
// Immutable value object representing the AI-proposed (and physician-confirmed)
// column mapping for an ImportBatch.

import type { ColumnMapping, StandardField } from '@medicore/contracts';

export class ColumnMappingVO {
  /** Raw column name → standard field (or 'custom'/'ignore'). */
  readonly mapping: ColumnMapping;
  /** Raw column name → human-readable custom field name (only for 'custom' entries). */
  readonly customFieldNames: Record<string, string>;
  /** Row indices identified as junk (totals, means, notes). */
  readonly junkRowIndices: number[];

  constructor(
    mapping: ColumnMapping,
    customFieldNames: Record<string, string> = {},
    junkRowIndices: number[] = [],
  ) {
    // Defensive copy — value objects are immutable.
    this.mapping = { ...mapping };
    this.customFieldNames = { ...customFieldNames };
    this.junkRowIndices = [...junkRowIndices].sort((a, b) => a - b);
  }

  /** Columns mapped to `ignore` — e.g. phone fields excluded per BR-IMP-007. */
  get ignoredColumns(): string[] {
    return Object.entries(this.mapping)
      .filter(([, field]) => field === 'ignore')
      .map(([col]) => col);
  }

  /** Columns mapped to a standard clinical field (not 'custom' or 'ignore'). */
  get standardMapped(): Array<{ column: string; field: StandardField }> {
    return Object.entries(this.mapping)
      .filter(([, field]) => field !== 'custom' && field !== 'ignore')
      .map(([column, field]) => ({ column, field }));
  }

  /** Columns mapped to 'custom' user-defined fields. */
  get customMapped(): string[] {
    return Object.entries(this.mapping)
      .filter(([, field]) => field === 'custom')
      .map(([col]) => col);
  }

  isJunkRow(rowIndex: number): boolean {
    return this.junkRowIndices.includes(rowIndex);
  }

  equals(other: ColumnMappingVO): boolean {
    return (
      JSON.stringify(this.mapping) === JSON.stringify(other.mapping) &&
      JSON.stringify(this.customFieldNames) === JSON.stringify(other.customFieldNames) &&
      JSON.stringify(this.junkRowIndices) === JSON.stringify(other.junkRowIndices)
    );
  }
}
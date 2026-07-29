// apps/api/src/domain/research/value-objects/cross-tab.vo.ts
// Value object for a cross-tabulation (contingency table) result (spec §2,
// BR-RES-004). Enforces construction invariants and applies N<5 suppression
// to cells per the spec.

import type { CrossTabCell } from '@medicore/contracts';

const MIN_CELL = 5; // BR-RES-004

export interface CrossTabProps {
  rowField: string;
  colField: string;
  rows: string[];
  cols: string[];
  cells: CrossTabCell[][];
  rowTotals: number[];
  colTotals: number[];
  grandTotal: number;
  chiSquare: number | null;
  chiSquareP: number | null;
  fisherExactP: number | null;
  oddsRatio: number | null;
  oddsRatioCi95: [number, number] | null;
  warnings: string[];
}

export class CrossTabVO {
  readonly rowField: string;
  readonly colField: string;
  readonly rows: string[];
  readonly cols: string[];
  readonly cells: CrossTabCell[][];
  readonly rowTotals: number[];
  readonly colTotals: number[];
  readonly grandTotal: number;
  readonly chiSquare: number | null;
  readonly chiSquareP: number | null;
  readonly fisherExactP: number | null;
  readonly oddsRatio: number | null;
  readonly oddsRatioCi95: [number, number] | null;
  readonly warnings: string[];

  private constructor(props: CrossTabProps) {
    this.rowField = props.rowField;
    this.colField = props.colField;
    this.rows = props.rows;
    this.cols = props.cols;
    this.cells = props.cells;
    this.rowTotals = props.rowTotals;
    this.colTotals = props.colTotals;
    this.grandTotal = props.grandTotal;
    this.chiSquare = props.chiSquare;
    this.chiSquareP = props.chiSquareP;
    this.fisherExactP = props.fisherExactP;
    this.oddsRatio = props.oddsRatio;
    this.oddsRatioCi95 = props.oddsRatioCi95;
    this.warnings = props.warnings ?? [];
  }

  static create(props: CrossTabProps): CrossTabVO {
    // Invariant: cells must be rows × cols shaped
    if (props.cells.length !== props.rows.length) {
      throw new Error('CrossTab cells row count must equal rows length');
    }
    for (const row of props.cells) {
      if (row.length !== props.cols.length) {
        throw new Error('CrossTab cells col count must equal cols length');
      }
    }
    return new CrossTabVO(props);
  }

  /**
   * Apply BR-RES-004 N<5 suppression: returns a cells matrix where any cell
   * with count < 5 is marked suppressed=true (count hidden). Used for display +
   * export (BR-RES-002.UnsafeUse Annex).
   */
  static suppress(cells: CrossTabCell[][]): CrossTabCell[][] {
    return cells.map((row) =>
      row.map((cell) => ({
        count: cell.count,
        suppressed: cell.count < MIN_CELL,
      })),
    );
  }

  /** Whether any cell is suppressed (drives the "some cells <5" footer). */
  get hasSuppressedCells(): boolean {
    return this.cells.some((row) => row.some((c) => c.suppressed));
  }

  get hasFisherFallback(): boolean {
    return this.fisherExactP !== null;
  }

  toDTO() {
    return {
      rowField: this.rowField,
      colField: this.colField,
      rows: this.rows,
      cols: this.cols,
      cells: this.cells,
      rowTotals: this.rowTotals,
      colTotals: this.colTotals,
      grandTotal: this.grandTotal,
      chiSquare: this.chiSquare,
      chiSquareP: this.chiSquareP,
      fisherExactP: this.fisherExactP,
      oddsRatio: this.oddsRatio,
      oddsRatioCi95: this.oddsRatioCi95,
      warnings: this.warnings,
    };
  }
}
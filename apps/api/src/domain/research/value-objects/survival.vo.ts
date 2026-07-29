// apps/api/src/domain/research/value-objects/survival.vo.ts
// Value object for a Kaplan-Meier survival curve result (spec §1, §3).
// Enforces construction invariants: parallel arrays of equal length.

export interface SurvivalProps {
  timePoints: number[];
  survival: number[];
  ciLower: number[];
  ciUpper: number[];
  riskTable: Array<{
    time: number;
    survival: number;
    ciLower: number | null;
    ciUpper: number | null;
    nAtRisk: number;
    nEvents: number;
  }>;
  logRankP: number | null;
  medianSurvival: number | null;
  warnings: string[];
}

export class SurvivalCurveVO {
  readonly timePoints: number[];
  readonly survival: number[];
  readonly ciLower: number[];
  readonly ciUpper: number[];
  readonly riskTable: SurvivalProps['riskTable'];
  readonly logRankP: number | null;
  readonly medianSurvival: number | null;
  readonly warnings: string[];

  private constructor(props: SurvivalProps) {
    this.timePoints = props.timePoints;
    this.survival = props.survival;
    this.ciLower = props.ciLower;
    this.ciUpper = props.ciUpper;
    this.riskTable = props.riskTable;
    this.logRankP = props.logRankP;
    this.medianSurvival = props.medianSurvival;
    this.warnings = props.warnings ?? [];
  }

  static create(props: SurvivalProps): SurvivalCurveVO {
    // Invariant: parallel arrays must have equal length
    const { timePoints, survival, ciLower, ciUpper } = props;
    const len = timePoints.length;
    if (survival.length !== len || ciLower.length !== len || ciUpper.length !== len) {
      throw new Error('SurvivalCurve arrays (timePoints/survival/ciLower/ciUpper) must have equal length');
    }
    // Invariant: survival probabilities must be in [0,1]
    for (const s of survival) {
      if (s < 0 || s > 1) throw new Error('SurvivalCurve survival values must be in [0,1]');
    }
    // Invariant: logRankP in [0,1]
    if (props.logRankP !== null && (props.logRankP < 0 || props.logRankP > 1)) {
      throw new Error('SurvivalCurve logRankP must be in [0,1]');
    }
    return new SurvivalCurveVO(props);
  }

  get isSignificantAt05(): boolean {
    return this.logRankP !== null && this.logRankP < 0.05;
  }

  toDTO() {
    return {
      timePoints: this.timePoints,
      survival: this.survival,
      ciLower: this.ciLower,
      ciUpper: this.ciUpper,
      riskTable: this.riskTable,
      logRankP: this.logRankP,
      medianSurvival: this.medianSurvival,
      warnings: this.warnings,
    };
  }
}
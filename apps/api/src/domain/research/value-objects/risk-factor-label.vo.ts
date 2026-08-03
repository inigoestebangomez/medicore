// apps/api/src/domain/research/value-objects/risk-factor-label.vo.ts
// Value object: RiskFactorLabel — REQ-FB-011. An association is labelled
// RISK_FACTOR when OR/HR > 1 and PROTECTIVE_FACTOR when OR/HR < 1 (and p<0.05).

export type RiskFactorLabelLiteral = 'RISK_FACTOR' | 'PROTECTIVE_FACTOR' | 'NEUTRAL';

export class RiskFactorLabelVO {
  private constructor(public readonly value: RiskFactorLabelLiteral) {}

  static create(value: string): RiskFactorLabelVO {
    if (value !== 'RISK_FACTOR' && value !== 'PROTECTIVE_FACTOR' && value !== 'NEUTRAL') {
      throw new Error(`invalid_risk_factor_label: ${value}`);
    }
    return new RiskFactorLabelVO(value);
  }

  /**
   * Classify an effect estimate (OR or HR) into a risk/protective label.
   * REQ-FB-011: OR/HR > 1 → RISK_FACTOR; < 1 → PROTECTIVE_FACTOR; else NEUTRAL.
   * A null/NaN estimate or non-significant result yields NEUTRAL.
   */
  static fromEffect(effect: number | null, pValue: number | null, alpha = 0.05): RiskFactorLabelVO {
    if (effect === null || Number.isNaN(effect)) return new RiskFactorLabelVO('NEUTRAL');
    // Significance gate: labelling only applies to significant associations
    // (p < alpha). Non-significant trends stay NEUTRAL.
    if (pValue !== null && pValue >= alpha) return new RiskFactorLabelVO('NEUTRAL');
    if (effect > 1) return new RiskFactorLabelVO('RISK_FACTOR');
    if (effect < 1) return new RiskFactorLabelVO('PROTECTIVE_FACTOR');
    return new RiskFactorLabelVO('NEUTRAL');
  }

  equals(other: RiskFactorLabelVO): boolean {
    return this.value === other.value;
  }
}
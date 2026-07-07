// apps/api/src/domain/scale/errors/invalid-scale-scores.error.ts
// BR-SCA-001: Scores do not match expected schema for scaleType

export class InvalidScaleScoresError extends Error {
  public readonly scaleType: string;
  public readonly code = 'INVALID_SCALE_SCORES';

  constructor(scaleType: string, message: string) {
    super(`Invalid scores for ${scaleType}: ${message}`);
    this.name = 'InvalidScaleScoresError';
    this.scaleType = scaleType;
  }
}
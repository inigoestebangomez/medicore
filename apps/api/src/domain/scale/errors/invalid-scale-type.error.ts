// apps/api/src/domain/scale/errors/invalid-scale-type.error.ts

export class InvalidScaleTypeError extends Error {
  public readonly scaleType: string;
  public readonly code = 'INVALID_SCALE_TYPE';

  constructor(scaleType: string) {
    super(`Invalid scale type: ${scaleType}`);
    this.name = 'InvalidScaleTypeError';
    this.scaleType = scaleType;
  }
}
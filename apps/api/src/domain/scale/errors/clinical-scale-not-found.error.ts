// apps/api/src/domain/scale/errors/clinical-scale-not-found.error.ts

export class ClinicalScaleNotFoundError extends Error {
  public readonly id: string;
  public readonly code = 'CLINICAL_SCALE_NOT_FOUND';

  constructor(id: string) {
    super(`Clinical scale not found: ${id}`);
    this.name = 'ClinicalScaleNotFoundError';
    this.id = id;
  }
}
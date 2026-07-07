// apps/api/src/domain/medication/errors/invalid-medication-transition.error.ts

export class InvalidMedicationTransitionError extends Error {
  public readonly fromStatus: string;
  public readonly toStatus: string;
  public readonly code = 'INVALID_MEDICATION_TRANSITION';

  constructor(fromStatus: string, toStatus: string) {
    super(`Invalid medication transition: ${fromStatus} → ${toStatus}`);
    this.name = 'InvalidMedicationTransitionError';
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}
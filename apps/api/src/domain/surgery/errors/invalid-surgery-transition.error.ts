// apps/api/src/domain/surgery/errors/invalid-surgery-transition.error.ts

export class InvalidSurgeryTransitionError extends Error {
  public readonly fromStatus: string;
  public readonly toStatus: string;
  public readonly code = 'INVALID_SURGERY_TRANSITION';

  constructor(fromStatus: string, toStatus: string) {
    super(`Invalid surgery transition: ${fromStatus} → ${toStatus}`);
    this.name = 'InvalidSurgeryTransitionError';
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}
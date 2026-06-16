// apps/api/src/domain/patient/errors/scheduled-surgery-blocks-delete.error.ts
// BR-PAT-005: Soft-delete is blocked if patient has SCHEDULED surgeries

export class ScheduledSurgeryBlocksDeleteError extends Error {
  public readonly patientId: string;

  constructor(patientId: string) {
    super(`Cannot delete patient ${patientId}: has scheduled surgeries`);
    this.name = 'ScheduledSurgeryBlocksDeleteError';
    this.patientId = patientId;
  }
}
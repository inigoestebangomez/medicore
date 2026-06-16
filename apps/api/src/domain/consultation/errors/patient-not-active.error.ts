// apps/api/src/domain/consultation/errors/patient-not-active.error.ts

export class PatientNotActiveError extends Error {
  public readonly patientId: string;
  public readonly code = 'PATIENT_NOT_ACTIVE';

  constructor(patientId: string) {
    super(`Patient is not active: ${patientId}`);
    this.name = 'PatientNotActiveError';
  }
}
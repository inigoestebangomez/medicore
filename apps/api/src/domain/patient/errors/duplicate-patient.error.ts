// apps/api/src/domain/patient/errors/duplicate-patient.error.ts
// BR-PAT-002: Duplicate detection by lastName + birthDate

export class DuplicatePatientError extends Error {
  public readonly similarPatients: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    birthDate: string | null;
    nhc: string;
  }>;
  public readonly confirmationRequired: boolean;

  constructor(candidates: Array<{ id: string; firstName: string | null; lastName: string | null; birthDate: string | null; nhc: string }>) {
    super('Duplicate patient detected. Confirm creation with X-Confirm-Duplicate header.');
    this.name = 'DuplicatePatientError';
    this.similarPatients = candidates;
    this.confirmationRequired = true;
  }
}

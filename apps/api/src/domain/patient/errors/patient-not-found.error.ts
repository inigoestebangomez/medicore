// apps/api/src/domain/patient/errors/patient-not-found.error.ts

export class PatientNotFoundError extends Error {
  constructor(id: string) {
    super(`Patient not found: ${id}`);
    this.name = 'PatientNotFoundError';
  }
}
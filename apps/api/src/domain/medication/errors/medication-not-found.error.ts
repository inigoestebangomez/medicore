// apps/api/src/domain/medication/errors/medication-not-found.error.ts

export class MedicationNotFoundError extends Error {
  public readonly id: string;
  public readonly code = 'MEDICATION_NOT_FOUND';

  constructor(id: string) {
    super(`Medication prescription not found: ${id}`);
    this.name = 'MedicationNotFoundError';
    this.id = id;
  }
}
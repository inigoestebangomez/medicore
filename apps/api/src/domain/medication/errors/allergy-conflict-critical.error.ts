// apps/api/src/domain/medication/errors/allergy-conflict-critical.error.ts
// BR-MED-001: ANAPHYLAXIS allergy blocks prescription without explicit override

export class AllergyConflictCriticalError extends Error {
  public readonly substance: string;
  public readonly code = 'ALLERGY_CONFLICT_CRITICAL';

  constructor(substance: string) {
    super(`Critical allergy conflict: ANAPHYLAXIS reaction to "${substance}"`);
    this.name = 'AllergyConflictCriticalError';
    this.substance = substance;
  }
}
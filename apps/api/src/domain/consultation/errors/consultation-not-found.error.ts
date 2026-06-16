// apps/api/src/domain/consultation/errors/consultation-not-found.error.ts

export class ConsultationNotFoundError extends Error {
  public readonly id: string;
  public readonly code = 'CONSULTATION_NOT_FOUND';

  constructor(id: string) {
    super(`Consultation not found: ${id}`);
    this.name = 'ConsultationNotFoundError';
  }
}
// apps/api/src/domain/surgery/errors/surgery-not-found.error.ts

export class SurgeryNotFoundError extends Error {
  public readonly id: string;
  public readonly code = 'SURGERY_NOT_FOUND';

  constructor(id: string) {
    super(`Surgery not found: ${id}`);
    this.name = 'SurgeryNotFoundError';
    this.id = id;
  }
}
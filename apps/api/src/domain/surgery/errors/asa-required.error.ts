// apps/api/src/domain/surgery/errors/asa-required.error.ts

export class AsaRequiredError extends Error {
  public readonly code = 'ASA_REQUIRED';

  constructor() {
    super('ASA classification is required for this surgery operation');
    this.name = 'AsaRequiredError';
  }
}
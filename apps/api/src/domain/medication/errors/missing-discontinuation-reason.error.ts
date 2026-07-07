// apps/api/src/domain/medication/errors/missing-discontinuation-reason.error.ts
// BR-MED-003: Discontinuation requires a reason

export class MissingDiscontinuationReasonError extends Error {
  public readonly code = 'MISSING_DISCONTINUATION_REASON';

  constructor() {
    super('Discontinuation reason is required when discontinuing a prescription');
    this.name = 'MissingDiscontinuationReasonError';
  }
}
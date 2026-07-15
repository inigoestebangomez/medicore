// apps/api/src/domain/research/errors/insufficient-sample-size.error.ts
// BR-RES-004: charts/stats with N<5 are hidden to avoid re-identification risk.

export class InsufficientSampleSizeError extends Error {
  public readonly code = 'INSUFFICIENT_SAMPLE_SIZE';

  constructor(
    message = 'Sample size N<5 is below the minimum for statistical display — BR-RES-004',
  ) {
    super(message);
    this.name = 'InsufficientSampleSizeError';
  }
}
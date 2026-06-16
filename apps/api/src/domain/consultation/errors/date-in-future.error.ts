// apps/api/src/domain/consultation/errors/date-in-future.error.ts

export class DateInFutureError extends Error {
  public readonly date: string;
  public readonly code = 'DATE_IN_FUTURE';

  constructor(date: string) {
    super(`Consultation date cannot be more than 24 hours in the future: ${date}`);
    this.name = 'DateInFutureError';
  }
}
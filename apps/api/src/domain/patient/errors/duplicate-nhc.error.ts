// apps/api/src/domain/patient/errors/duplicate-nhc.error.ts

export class DuplicateNhcError extends Error {
  public readonly nhc: string;

  constructor(nhc: string) {
    super(`NHC already exists in this organization: ${nhc}`);
    this.name = 'DuplicateNhcError';
    this.nhc = nhc;
  }
}
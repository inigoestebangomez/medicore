// apps/api/src/domain/consultation/errors/invalid-procedure-code.error.ts

export class InvalidProcedureCodeError extends Error {
  public readonly invalidCodes: string[];
  public readonly errorCode = 'INVALID_PROCEDURE_CODE';

  constructor(invalidCodes: string[]) {
    super(`Invalid procedure codes: ${invalidCodes.join(', ')}`);
    this.name = 'InvalidProcedureCodeError';
    this.invalidCodes = invalidCodes;
  }
}
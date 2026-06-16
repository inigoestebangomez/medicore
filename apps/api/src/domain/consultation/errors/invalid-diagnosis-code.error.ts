// apps/api/src/domain/consultation/errors/invalid-diagnosis-code.error.ts

export class InvalidDiagnosisCodeError extends Error {
  public readonly diagnosisCode: string;
  public readonly reason: string;
  public readonly errorCode = 'INVALID_DIAGNOSIS_CODE';

  constructor(code: string, reason: string) {
    super(`Invalid diagnosis code: ${code} — ${reason}`);
    this.name = 'InvalidDiagnosisCodeError';
    this.diagnosisCode = code;
    this.reason = reason;
  }
}
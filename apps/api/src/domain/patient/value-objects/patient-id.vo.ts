// apps/api/src/domain/patient/value-objects/patient-id.vo.ts
// Patient ID — UUID wrapper for type safety

export class PatientId {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static from(value: string): PatientId {
    return new PatientId(value);
  }

  static generate(): PatientId {
    return new PatientId(crypto.randomUUID());
  }

  toString(): string {
    return this.value;
  }
}
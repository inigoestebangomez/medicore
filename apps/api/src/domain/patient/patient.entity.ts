// apps/api/src/domain/patient/patient.entity.ts
// Domain entity: Patient — computed properties, business rules

import type { Sex, IdDocumentType, BloodType, AllergySeverity, AllergyStatus } from '@medicore/contracts';

export interface AllergySnapshot {
  id: string;
  patientId: string;
  substance: string;
  severity: AllergySeverity;
  status: AllergyStatus;
}

export interface PatientProps {
  id: string;
  organizationId: string;
  nhc: string;
  firstName: string | null;
  lastName: string | null;
  birthDate: Date | null;
  sex: Sex;
  phone?: string | null;
  email?: string | null;
  address?: Record<string, unknown> | null;
  emergencyContact?: Record<string, unknown> | null;
  idDocument?: string | null;
  idDocType?: IdDocumentType;
  bloodType?: BloodType;
  notes?: string | null;
  createdBy: string;
  updatedBy?: string | null;
  allergies?: AllergySnapshot[];
  // Phase 11 — import origin tracking (backward-compatible; null = manual entry)
  importedData?: Record<string, unknown> | null;
  importSource?: string | null;       // "xlsx" | "csv" | "tsv" | "manual" | null
  importBatchId?: string | null;
  // Seven Categories — age semantics (spec §1)
  ageReferenceDate?: { day: number; month: number; year: number } | null;
  ageAtReferenceDate?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export class Patient {
  readonly id: string;
  readonly organizationId: string;
  readonly nhc: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly birthDate: Date | null;
  readonly sex: Sex;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: Record<string, unknown> | null;
  readonly emergencyContact: Record<string, unknown> | null;
  readonly idDocument: string | null;
  readonly idDocType: IdDocumentType;
  readonly bloodType: BloodType;
  readonly notes: string | null;
  readonly createdBy: string;
  readonly updatedBy: string | null;
  readonly allergies: AllergySnapshot[];
  readonly importedData: Record<string, unknown> | null;
  readonly importSource: string | null;
  readonly importBatchId: string | null;
  readonly ageReferenceDate: { day: number; month: number; year: number } | null;
  readonly ageAtReferenceDate: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(props: PatientProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.nhc = props.nhc;
    this.firstName = props.firstName;
    this.lastName = props.lastName;
    this.birthDate = props.birthDate;
    this.sex = props.sex;
    this.phone = props.phone ?? null;
    this.email = props.email ?? null;
    this.address = (props.address as Record<string, unknown>) ?? null;
    this.emergencyContact = (props.emergencyContact as Record<string, unknown>) ?? null;
    this.idDocument = props.idDocument ?? null;
    this.idDocType = props.idDocType ?? 'DNI';
    this.bloodType = props.bloodType ?? 'UNKNOWN';
    this.notes = props.notes ?? null;
    this.createdBy = props.createdBy;
    this.updatedBy = props.updatedBy ?? null;
    this.allergies = props.allergies ?? [];
    this.importedData = (props.importedData as Record<string, unknown>) ?? null;
    this.importSource = props.importSource ?? null;
    this.importBatchId = props.importBatchId ?? null;
    this.ageReferenceDate = props.ageReferenceDate ?? null;
    this.ageAtReferenceDate = props.ageAtReferenceDate ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    this.deletedAt = props.deletedAt ?? null;
  }

  /**
   * Calculate age in years based on birthDate.
   * BR-PAT-007: isPediatric = age < 14
   * SDD import-data-quality: returns null when birthDate is null (unknown DOB).
   * SDD seven-categories: when birthDate is null but ageReferenceDate is set,
   * derives age from the reference date with visible provenance (spec §1).
   * Never fabricates a birth date.
   */
  age(referenceDate: Date = new Date()): number | null {
    if (this.birthDate === null) return null;
    let age = referenceDate.getFullYear() - this.birthDate.getFullYear();
    const monthDiff = referenceDate.getMonth() - this.birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < this.birthDate.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * Age with reference date fallback (spec §1).
   * When birthDate is absent, uses ageReferenceDate (full day/month/year) to
   * compute a reference-based age. Returns null if neither is available.
   * The `provenance` field indicates how the age was derived.
   */
  ageWithFallback(): { age: number | null; provenance: 'birth-date' | 'reference-date' | 'none' } {
    if (this.birthDate !== null) {
      return { age: this.age(), provenance: 'birth-date' };
    }
    if (this.ageReferenceDate !== null && this.ageAtReferenceDate !== null) {
      // Calculate years elapsed since the reference date
      const refDate = new Date(
        this.ageReferenceDate.year,
        this.ageReferenceDate.month - 1,
        this.ageReferenceDate.day,
      );
      const now = new Date();
      const yearsSinceRef = now.getFullYear() - refDate.getFullYear();
      const adjustedAge = this.ageAtReferenceDate + yearsSinceRef;
      return { age: Math.max(0, adjustedAge), provenance: 'reference-date' };
    }
    return { age: null, provenance: 'none' };
  }

  /**
   * BR-PAT-007: isPediatric = true when age < 14
   * SDD import-data-quality: unknown age (null birthDate) is NOT pediatric.
   */
  isPediatric(referenceDate: Date = new Date()): boolean {
    const age = this.age(referenceDate);
    return age === null ? false : age < 14;
  }

  /**
   * BR-PAT-006: ANAPHYLAXIS + ACTIVE = critical allergy.
   * Must show persistent banner when true.
   */
  get hasCriticalAllergy(): boolean {
    return this.allergies.some(
      (a) => a.severity === 'ANAPHYLAXIS' && a.status === 'ACTIVE',
    );
  }

  /**
   * True when any allergy has status = ACTIVE
   */
  get hasActiveAllergies(): boolean {
    return this.allergies.some((a) => a.status === 'ACTIVE');
  }

  /**
   * Soft delete: sets deletedAt to current timestamp.
   */
  softDelete(): Patient {
    return new Patient({ ...this, deletedAt: new Date() });
  }

  /**
   * Anonymize PII for GDPR compliance.
   * Preserves NHC for clinical reference.
   */
  anonymize(): Patient {
    return new Patient({
      ...this,
      firstName: '***',
      lastName: '***',
      phone: null,
      email: null,
      address: null,
      emergencyContact: null,
      idDocument: null,
      notes: null,
    });
  }
}

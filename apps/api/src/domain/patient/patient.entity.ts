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
  firstName: string;
  lastName: string;
  birthDate: Date;
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
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export class Patient {
  readonly id: string;
  readonly organizationId: string;
  readonly nhc: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly birthDate: Date;
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
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    this.deletedAt = props.deletedAt ?? null;
  }

  /**
   * Calculate age in years based on birthDate.
   * BR-PAT-007: isPediatric = age < 14
   */
  age(referenceDate: Date = new Date()): number {
    let age = referenceDate.getFullYear() - this.birthDate.getFullYear();
    const monthDiff = referenceDate.getMonth() - this.birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < this.birthDate.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * BR-PAT-007: isPediatric = true when age < 14
   */
  isPediatric(referenceDate: Date = new Date()): boolean {
    return this.age(referenceDate) < 14;
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
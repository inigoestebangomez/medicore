// apps/api/src/application/patient/queries/get-patient.use-case.ts
// BR-RBAC-002: VIEWER role omits sensitive fields (phone, email, address, idDocument, emergencyContact)

import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import { PatientNotFoundError } from '@/domain/patient/errors/patient-not-found.error';
import type { MemberRole } from '@medicore/contracts';

export interface GetPatientQuery {
  id: string;
  organizationId: string;
  role: MemberRole;
}

export interface PatientPublicResponse {
  id: string;
  nhc: string;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  sex: string;
  age: number | null;
  isPediatric: boolean;
  hasCriticalAllergy: boolean;
  hasActiveAllergies: boolean;
  idDocType?: string;
  bloodType?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Sensitive — only for PHYSICIAN/OWNER/ADMIN
  phone?: string | null;
  email?: string | null;
  address?: Record<string, unknown> | null;
  idDocument?: string | null;
  emergencyContact?: Record<string, unknown> | null;
}

export class GetPatientUseCase {
  constructor(private readonly patientRepo: IPatientRepository) {}

  async execute(query: GetPatientQuery): Promise<PatientPublicResponse> {
    const { id, organizationId, role } = query;

    const patient = await this.patientRepo.findByIdWithAllergies(id, organizationId);
    if (!patient) {
      throw new PatientNotFoundError(id);
    }

    const response: PatientPublicResponse = {
      id: patient.id,
      nhc: patient.nhc,
      firstName: patient.firstName,
      lastName: patient.lastName,
      birthDate: patient.birthDate ? patient.birthDate.toISOString() : null,
      sex: patient.sex,
      age: patient.age(),
      isPediatric: patient.isPediatric(),
      hasCriticalAllergy: patient.hasCriticalAllergy,
      hasActiveAllergies: patient.hasActiveAllergies,
      idDocType: patient.idDocType,
      bloodType: patient.bloodType,
      notes: patient.notes ?? undefined,
      createdAt: patient.createdAt.toISOString(),
      updatedAt: patient.updatedAt.toISOString(),
    };

    // BR-RBAC-002: Only PHI-authorized roles see sensitive fields
    if (role === 'PHYSICIAN' || role === 'OWNER' || role === 'ADMIN') {
      response.phone = patient.phone;
      response.email = patient.email;
      response.address = patient.address as Record<string, unknown> | null | undefined;
      response.idDocument = patient.idDocument ?? undefined;
      response.emergencyContact = patient.emergencyContact as Record<string, unknown> | null | undefined;
    }

    return response;
  }
}

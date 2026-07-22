// apps/api/src/application/patient/commands/create-patient.use-case.ts
// BR-PAT-001: Sequential NHC generation
// BR-PAT-002: Duplicate detection by lastName + birthDate

import type { IPatientRepository, CreatePatientInput } from '@/domain/patient/patient.repository.interface';
import { Patient } from '@/domain/patient/patient.entity';
import { NHC } from '@/domain/patient/value-objects/nhc.vo';
import { normalizeName } from '@/domain/patient/name-normalizer';
import { DuplicatePatientError } from '@/domain/patient/errors/duplicate-patient.error';
import { DuplicateNhcError } from '@/domain/patient/errors/duplicate-nhc.error';

export interface CreatePatientCommand {
  firstName: string;
  lastName: string;
  birthDate: string | null;
  sex: string;
  phone?: string;
  email?: string;
  address?: Record<string, unknown>;
  emergencyContact?: Record<string, unknown>;
  idDocument?: string;
  idDocType?: string;
  nhc?: string;
  bloodType?: string;
  notes?: string;
  organizationId: string;
  createdBy: string;
  confirmDuplicate?: boolean;
}

export class CreatePatientUseCase {
  constructor(private readonly patientRepo: IPatientRepository) {}

  async execute(command: CreatePatientCommand): Promise<Patient> {
    const { organizationId, createdBy } = command;

    // BR-PAT-001: Generate or validate NHC
    let nhc: string;
    if (command.nhc) {
      // External NHC — must match YYYY-NNNNN format
      if (!NHC.isValid(command.nhc)) {
        throw new DuplicateNhcError(command.nhc);
      }
      nhc = command.nhc;
    } else {
      nhc = await this.patientRepo.getNextNhcSequence(organizationId);
    }

    // BR-PAT-002: Duplicate detection by lastName + birthDate. SDD
    // import-data-quality: when the birthDate is unknown (null) there is no
    // DOB signal to match on, so duplicate detection is skipped.
    const birthDate: Date | null = command.birthDate ? new Date(command.birthDate) : null;
    let duplicates: Awaited<ReturnType<IPatientRepository['findDuplicates']>> = [];
    if (birthDate !== null) {
      duplicates = await this.patientRepo.findDuplicates(
        organizationId,
        command.lastName,
        birthDate,
      );
    }

    if (duplicates.length > 0 && !command.confirmDuplicate) {
      throw new DuplicatePatientError(
        duplicates.map((p) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          birthDate: p.birthDate ? p.birthDate.toISOString() : null,
          nhc: p.nhc,
        })),
      );
    }

    // Create patient. SDD import-data-quality: normalize the name input to
    // title case (shared normalizer used by both import and manual creation).
    const patientData: CreatePatientInput = {
      nhc,
      firstName: normalizeName(command.firstName),
      lastName: normalizeName(command.lastName),
      birthDate,
      sex: command.sex,
      phone: command.phone ?? null,
      email: command.email ?? null,
      address: command.address ?? null,
      emergencyContact: command.emergencyContact ?? null,
      idDocument: command.idDocument ?? null,
      idDocType: command.idDocType ?? 'DNI',
      bloodType: command.bloodType ?? 'UNKNOWN',
      notes: command.notes ?? null,
      organizationId,
      createdBy,
    };

    return this.patientRepo.create(patientData);
  }
}
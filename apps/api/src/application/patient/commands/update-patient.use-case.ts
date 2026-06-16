// apps/api/src/application/patient/commands/update-patient.use-case.ts
import type { IPatientRepository, UpdatePatientInput } from '@/domain/patient/patient.repository.interface';
import { PatientNotFoundError } from '@/domain/patient/errors/patient-not-found.error';

export interface UpdatePatientCommand {
  id: string;
  organizationId: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  sex?: string;
  phone?: string | null;
  email?: string | null;
  address?: Record<string, unknown> | null;
  emergencyContact?: Record<string, unknown> | null;
  idDocument?: string | null;
  idDocType?: string;
  bloodType?: string;
  notes?: string | null;
  updatedBy: string;
}

export class UpdatePatientUseCase {
  constructor(private readonly patientRepo: IPatientRepository) {}

  async execute(command: UpdatePatientCommand) {
    const { id, organizationId, updatedBy } = command;

    // Verify patient exists and belongs to the org
    const existing = await this.patientRepo.findById(id, organizationId);
    if (!existing) {
      throw new PatientNotFoundError(id);
    }

    // Build update data — only include provided fields
    const updateData: UpdatePatientInput = {
      updatedBy,
    };

    if (command.firstName !== undefined) updateData.firstName = command.firstName;
    if (command.lastName !== undefined) updateData.lastName = command.lastName;
    if (command.birthDate !== undefined) updateData.birthDate = new Date(command.birthDate);
    if (command.sex !== undefined) updateData.sex = command.sex;
    if (command.phone !== undefined) updateData.phone = command.phone;
    if (command.email !== undefined) updateData.email = command.email;
    if (command.address !== undefined) updateData.address = command.address;
    if (command.emergencyContact !== undefined) updateData.emergencyContact = command.emergencyContact;
    if (command.idDocument !== undefined) updateData.idDocument = command.idDocument;
    if (command.idDocType !== undefined) updateData.idDocType = command.idDocType;
    if (command.bloodType !== undefined) updateData.bloodType = command.bloodType;
    if (command.notes !== undefined) updateData.notes = command.notes;

    return this.patientRepo.update(id, organizationId, updateData);
  }
}
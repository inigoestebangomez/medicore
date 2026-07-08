// AnonymizePatientUseCase
// Implements irreversible anonymization per BR-RGPD (docs/02-data-schema.md lines 988-995)
// WARNING: This operation is IRREVERSIBLE — PII data cannot be recovered after anonymization.
// Calls patient.anonymize() which sets firstName, lastName, phone, email, address,
// emergencyContact, idDocument, and notes to placeholder/null values.
// NHC is preserved for clinical reference continuity.

import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import { PatientNotFoundError } from '@/domain/patient/errors/patient-not-found.error';
import { AuditLogService } from '@/infrastructure/audit/audit-log.service';

export interface AnonymizePatientCommand {
  patientId: string;
  organizationId: string;
  userId: string;
  reason?: string;
}

export class AnonymizePatientHandler {
  constructor(
    private readonly patientRepo: IPatientRepository,
    private readonly auditLog: AuditLogService,
  ) {}

  async execute(command: AnonymizePatientCommand) {
    const { patientId, organizationId, userId, reason } = command;

    const patient = await this.patientRepo.findById(patientId, organizationId);
    if (!patient) {
      throw new PatientNotFoundError(patientId);
    }

    const anonymized = patient.anonymize();

    const updated = await this.patientRepo.update(patientId, organizationId, {
      firstName: anonymized.firstName,
      lastName: anonymized.lastName,
      phone: anonymized.phone,
      email: anonymized.email,
      address: anonymized.address,
      emergencyContact: anonymized.emergencyContact,
      idDocument: anonymized.idDocument,
      notes: anonymized.notes,
      updatedBy: userId,
    });

    await this.auditLog.log({
      organizationId,
      userId,
      action: 'ANONYMIZE',
      entityType: 'Patient',
      entityId: patientId,
      changes: {
        reason: reason ?? null,
        anonymizedFields: ['firstName', 'lastName', 'phone', 'email', 'address', 'emergencyContact', 'idDocument', 'notes'],
        nhcPreserved: patient.nhc,
      },
    });

    return updated;
  }
}

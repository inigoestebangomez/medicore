// apps/api/src/application/medication/commands/discontinue-medication.use-case.ts
// BR-MED-003: Discontinuation requires a reason
// BR-MED-001: State transition validation

import type { IMedicationRepository, UpdateMedicationInput } from '@/domain/medication/medication.repository.interface';
import type { Medication } from '@/domain/medication/medication.entity';
import { InvalidMedicationTransitionError } from '@/domain/medication/errors/invalid-medication-transition.error';
import { MissingDiscontinuationReasonError } from '@/domain/medication/errors/missing-discontinuation-reason.error';
import { MedicationNotFoundError } from '@/domain/medication/errors/medication-not-found.error';

export interface DiscontinueMedicationCommand {
  id: string;
  organizationId: string;
  discontinuationReason: string;
  userId: string;
}

export class DiscontinueMedicationUseCase {
  constructor(
    private readonly medicationRepo: IMedicationRepository,
  ) {}

  async execute(command: DiscontinueMedicationCommand): Promise<Medication> {
    // Find the medication
    const medication = await this.medicationRepo.findById(command.id, command.organizationId);
    if (!medication) {
      throw new MedicationNotFoundError(command.id);
    }

    // BR-MED-003: Discontinuation requires a reason
    if (!command.discontinuationReason || command.discontinuationReason.trim().length === 0) {
      throw new MissingDiscontinuationReasonError();
    }

    // BR-MED-001: Validate state transition
    if (!medication.canTransitionTo('DISCONTINUED')) {
      throw new InvalidMedicationTransitionError(medication.status, 'DISCONTINUED');
    }

    // Transition the entity — validates BR-MED-001 and BR-MED-003
    medication.transitionTo('DISCONTINUED', command.discontinuationReason);

    // Build audit log entry
    const auditLog = [{
      action: 'DISCONTINUE',
      performedBy: command.userId,
      performedAt: new Date(),
      details: `Prescription discontinued: ${command.discontinuationReason}`,
    }];

    // Persist the transition
    const updateData: UpdateMedicationInput = {
      status: 'DISCONTINUED',
      discontinuationReason: command.discontinuationReason,
      updatedBy: command.userId,
      auditLog,
    };

    return this.medicationRepo.update(command.id, command.organizationId, updateData);
  }
}
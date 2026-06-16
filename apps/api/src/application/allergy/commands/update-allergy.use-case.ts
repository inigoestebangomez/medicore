// apps/api/src/application/allergy/commands/update-allergy.use-case.ts
// BR-PAT-006: Changing severity to ANAPHYLAXIS requires explicit confirmation

import type { IAllergyRepository, UpdateAllergyInput } from '@/domain/allergy/allergy.repository.interface';

export interface UpdateAllergyCommand {
  id: string;
  organizationId: string;
  substance?: string;
  severity?: string;
  status?: string;
  reaction?: string | null;
  substanceCode?: string | null;
  onsetDate?: string | null;
  notes?: string | null;
  confirmAnaphylaxis?: boolean;
}

export class UpdateAllergyUseCase {
  constructor(private readonly allergyRepo: IAllergyRepository) {}

  async execute(command: UpdateAllergyCommand) {
    const { id, organizationId } = command;

    // Verify allergy exists
    const existing = await this.allergyRepo.findById(id, organizationId);
    if (!existing) {
      throw new Error('Allergy not found');
    }

    // BR-PAT-006: ANAPHYLAXIS severity requires explicit confirmation
    if (command.severity === 'ANAPHYLAXIS' && !command.confirmAnaphylaxis) {
      throw new Error('ANAPHYLAXIS allergy requires explicit confirmation');
    }

    const updateData: UpdateAllergyInput = {};

    if (command.substance !== undefined) updateData.substance = command.substance;
    if (command.severity !== undefined) updateData.severity = command.severity;
    if (command.status !== undefined) updateData.status = command.status;
    if (command.reaction !== undefined) updateData.reaction = command.reaction;
    if (command.substanceCode !== undefined) updateData.substanceCode = command.substanceCode;
    if (command.onsetDate !== undefined) updateData.onsetDate = command.onsetDate ? new Date(command.onsetDate) : null;
    if (command.notes !== undefined) updateData.notes = command.notes;

    return this.allergyRepo.update(id, organizationId, updateData);
  }
}
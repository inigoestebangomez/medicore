// apps/api/src/application/scale/commands/update-clinical-scale.use-case.ts
// BR-SCA-002: Server-side total recalculation on update

import type { IClinicalScaleRepository, UpdateClinicalScaleInput } from '@/domain/scale/scale.repository.interface';
import type { ClinicalScale } from '@/domain/scale/clinical-scale.entity';
import { ScaleTypeValidationMap } from '@medicore/contracts';
import { InvalidScaleScoresError } from '@/domain/scale/errors/invalid-scale-scores.error';
import { calculateTotal } from '@/domain/scale/value-objects/scale-calculator';

export interface UpdateClinicalScaleCommand {
  id: string;
  organizationId: string;
  scores?: Record<string, number>;
  notes?: string;
  userId: string;
}

export class UpdateClinicalScaleUseCase {
  constructor(
    private readonly scaleRepo: IClinicalScaleRepository,
  ) {}

  async execute(command: UpdateClinicalScaleCommand): Promise<ClinicalScale> {
    const scale = await this.scaleRepo.findById(command.id, command.organizationId);
    if (!scale) {
      const { ClinicalScaleNotFoundError } = await import('@/domain/scale/errors/clinical-scale-not-found.error');
      throw new ClinicalScaleNotFoundError(command.id);
    }

    let updateData: UpdateClinicalScaleInput = {
      updatedBy: command.userId,
    };

    if (command.scores) {
      // BR-SCA-001: Validate scores against per-scale type schema
      const schema = ScaleTypeValidationMap[scale.scaleType];
      const validationResult = schema.safeParse(command.scores);
      if (!validationResult.success) {
        const message = validationResult.error.issues.map(i => i.message).join('; ');
        throw new InvalidScaleScoresError(scale.scaleType, message);
      }

      // BR-SCA-002: Server-side total recalculation
      const total = calculateTotal(scale.scaleType, command.scores);

      updateData = {
        ...updateData,
        scores: command.scores,
        total,
      };
    }

    if (command.notes !== undefined) {
      updateData = {
        ...updateData,
        notes: command.notes,
      };
    }

    // Audit log
    const auditEntries = scale.diffForUpdate(
      { scores: command.scores, notes: command.notes },
      command.userId,
    );
    updateData.auditLog = auditEntries as any;

    return this.scaleRepo.update(command.id, command.organizationId, updateData);
  }
}
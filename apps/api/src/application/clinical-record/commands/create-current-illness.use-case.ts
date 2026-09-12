// apps/api/src/application/clinical-record/commands/create-current-illness.use-case.ts
// Use-case: Create a current illness entry (spec §3).
// Captures symptoms, duration, onset, evolution, and narrative.
// Partial entries allowed — missing temporal fields remain null.

import type { ICurrentIllnessRepository } from '@/domain/clinical-record/current-illness/current-illness.repository.interface';
import type { DurationUnit } from '@/domain/clinical-record/current-illness/current-illness-entry.entity';

export interface CreateCurrentIllnessCommand {
  organizationId: string;
  patientId: string;
  symptoms: string;
  durationValue?: number | null;
  durationUnit?: DurationUnit | null;
  onset?: Date | null;
  evolution?: string | null;
  narrative?: string | null;
  consultationId?: string | null;
  sourceType: string;
  authorId: string;
}

export class CreateCurrentIllnessUseCase {
  constructor(private readonly illnessRepo: ICurrentIllnessRepository) {}

  async execute(cmd: CreateCurrentIllnessCommand) {
    return this.illnessRepo.create({
      organizationId: cmd.organizationId,
      patientId: cmd.patientId,
      symptoms: cmd.symptoms,
      durationValue: cmd.durationValue ?? null,
      durationUnit: cmd.durationUnit ?? null,
      onset: cmd.onset ?? null,
      evolution: cmd.evolution ?? null,
      narrative: cmd.narrative ?? null,
      consultationId: cmd.consultationId ?? null,
      sourceType: cmd.sourceType,
      authorId: cmd.authorId,
      recordedAt: new Date(),
      reviewState: 'UNREVIEWED',
    });
  }
}

// apps/api/src/application/clinical-record/commands/update-diagnosis-status.use-case.ts
// Use-case: Transition diagnosis status (spec §6).
// Discarded diagnoses are excluded from active stats but retained for audit.

import type { IDiagnosisRepository } from '@/domain/clinical-record/diagnosis/diagnosis.repository.interface';
import type { DiagnosisStatus } from '@/domain/clinical-record/diagnosis/diagnosis.entity';

export interface UpdateDiagnosisStatusCommand {
  organizationId: string;
  diagnosisId: string;
  status: Extract<DiagnosisStatus, 'RESOLVED' | 'DISCARDED'>;
  reviewerId: string;
}

export class UpdateDiagnosisStatusUseCase {
  constructor(private readonly diagnosisRepo: IDiagnosisRepository) {}

  async execute(cmd: UpdateDiagnosisStatusCommand) {
    const diagnosis = await this.diagnosisRepo.findById(cmd.diagnosisId, cmd.organizationId);
    if (!diagnosis) {
      throw new Error('Diagnosis not found');
    }

    // Use domain entity methods for state transitions
    const updated =
      cmd.status === 'RESOLVED'
        ? diagnosis.resolve()
        : diagnosis.discard(cmd.reviewerId);

    return this.diagnosisRepo.updateStatus(cmd.diagnosisId, cmd.organizationId, updated.status, {
      resolvedAt: updated.resolvedAt ?? undefined,
      discardedAt: updated.discardedAt ?? undefined,
      discardedBy: updated.discardedBy ?? undefined,
    });
  }
}

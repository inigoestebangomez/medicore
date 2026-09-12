// apps/api/src/application/clinical-record/commands/confirm-lab-results.use-case.ts
// Use-case: Confirm or reject OCR-extracted lab results (spec §5).
// Only CONFIRMED results become clinical data; OCR provenance remains visible.

import type { ILabReportRepository } from '@/domain/clinical-record/lab/lab-report.repository.interface';

export interface ConfirmLabResultItem {
  index: number;
  reviewState: 'CONFIRMED' | 'REJECTED';
}

export interface ConfirmLabResultsCommand {
  organizationId: string;
  reportId: string;
  results: ConfirmLabResultItem[];
  reviewerId: string;
}

export class ConfirmLabResultsUseCase {
  constructor(private readonly labRepo: ILabReportRepository) {}

  async execute(cmd: ConfirmLabResultsCommand) {
    // 1. Load the report (tenant-scoped)
    const report = await this.labRepo.findById(cmd.reportId, cmd.organizationId);
    if (!report) {
      throw new Error('Lab report not found');
    }

    // 2. Apply review decisions to each result
    for (const item of cmd.results) {
      const target = report.results.find((r) => r.index === item.index);
      if (!target) {
        throw new Error(`Lab result at index ${item.index} not found`);
      }

      const updated =
        item.reviewState === 'CONFIRMED'
          ? target.confirm(cmd.reviewerId)
          : target.reject(cmd.reviewerId);

      await this.labRepo.updateResultReview({
        resultId: updated.id,
        reviewState: updated.reviewState,
        reviewedBy: cmd.reviewerId,
        reviewedAt: new Date(),
      });
    }

    // 3. Recompute overall review state
    const refreshed = await this.labRepo.findById(cmd.reportId, cmd.organizationId);
    if (refreshed) {
      const allReviewed = refreshed.results.every((r) => r.reviewState !== 'UNREVIEWED');
      if (allReviewed) {
        const allConfirmed = refreshed.results.every((r) => r.reviewState === 'CONFIRMED');
        await this.labRepo.updateOverallReviewState(
          cmd.reportId,
          allConfirmed ? 'CONFIRMED' : 'REJECTED',
        );
      }
    }

    // 4. Return the refreshed report
    return this.labRepo.findById(cmd.reportId, cmd.organizationId);
  }
}

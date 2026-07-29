// apps/api/src/application/research/commands/export-v2.handler.ts
// Export V2 (spec §6, design AD-4): enqueues a `pdf.render` BullMQ job with the
// anonymized, N<5-suppressed document props and returns the jobId. The worker
// renders the shared ReportDocument template to PDF → R2 → signed URL.
//
// BR-RES-002 (anonymized) is enforced at the data-gathering boundary: only
// aggregated stats + table/figure payloads (already anonymized upstream) are
// placed in the job payload — never raw patient identifiers.

import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Queue } from 'bullmq';
import type {
  ExportV2Request,
  ExportV2Response,
  ExportV2Style,
} from '@medicore/contracts';
import type { IResearchQueryRepository } from '@/domain/research/research-query.repository.interface';
import { ResearchQueryNotFoundError } from '@/domain/research/errors/research-query-not-found.error';
import { ExecuteResearchQueryHandler } from '../queries/execute-research-query.handler';

export interface ExportV2HandlerCommand {
  organizationId: string;
  userId: string;
  request: ExportV2Request;
}

@Injectable()
export class ExportV2Handler {
  constructor(
    @Inject('IResearchQueryRepository') private readonly queryRepo: IResearchQueryRepository,
    private readonly executeHandler: ExecuteResearchQueryHandler,
    @Inject('PDF_QUEUE') private readonly pdfQueue: Queue,
  ) {}

  async execute(cmd: ExportV2HandlerCommand): Promise<ExportV2Response> {
    // Gather the anonymized document payload before enqueueing (kept in-process
    // so the worker stays stateless). BR-RES-002: only stats/tables/figures; no PHI.
    const documentProps = await this.gatherDocument(cmd);

    const jobId = randomUUID();
    await this.pdfQueue.add(
      'render',
      {
        organizationId: cmd.organizationId,
        queryId: cmd.request.queryId,
        dashboardId: cmd.request.dashboardId,
        style: ((cmd.request.style ?? 'apa') as ExportV2Style),
        includeFigures: cmd.request.includeFigures ?? true,
        includeCrossTabs: cmd.request.includeCrossTabs ?? true,
        documentProps,
      },
      { jobId },
    );

    return { jobId, status: 'queued' };
  }

  private async gatherDocument(cmd: ExportV2HandlerCommand): Promise<Record<string, unknown>> {
    const req = cmd.request;
    if (req.queryId) {
      const query = await this.queryRepo.findById(req.queryId, cmd.organizationId);
      if (!query) throw new ResearchQueryNotFoundError(req.queryId);
      if (!query.isVisibleTo(cmd.userId)) throw new ResearchQueryNotFoundError(req.queryId);

      const result = await this.executeHandler.execute({
        queryId: req.queryId,
        organizationId: cmd.organizationId,
      });

      return {
        title: query.name,
        summary: {
          n: result.totalRows,
          stats: result.stats,
          distributions: result.distributions,
        },
        figures: [],
      };
    }
    return { title: 'Research export', summary: {}, figures: [] };
  }
}
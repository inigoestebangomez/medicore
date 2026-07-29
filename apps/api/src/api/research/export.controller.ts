// apps/api/src/api/research/export.controller.ts
// Export V2 endpoint (spec §6, BR-RES-002): async PDF export.
//   POST /research/export/v2 {queryId|dashboardId, includeFigures, style} → {jobId, status}
//
// Requires EXPORT_PATIENT (anonymized clinical export). Returns immediately
// with a jobId; the rendered PDF + signed URL are delivered via the BullMQ
// `pdf.render` worker + notification service (design AD-4).

import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { FeatureFlagGuard, RequireFeature } from '@/infrastructure/config/feature-flag.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type { JwtPayload, ExportV2Request, ExportV2Response } from '@medicore/contracts';
import { Action } from '@/domain/shared/rbac-permissions';
import { ExportV2Handler } from '@/application/research/commands/export-v2.handler';
import { ResearchQueryNotFoundError } from '@/domain/research/errors/research-query-not-found.error';
import { NotFoundException } from '@nestjs/common';

@Controller('research')
@RequireFeature('RESEARCH_V2_EXPORT_PDF')
@UseGuards(AuthGuard, RBACGuard, FeatureFlagGuard)
export class ExportV2Controller {
  constructor(private readonly exportHandler: ExportV2Handler) {}

  @Post('export/v2')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.EXPORT_PATIENT)
  async exportV2(
    @Body() body: ExportV2Request,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ data: ExportV2Response }> {
    if (!body?.queryId && !body?.dashboardId) {
      throw new BadRequestException('queryId or dashboardId is required');
    }
    try {
      const result = await this.exportHandler.execute({
        organizationId: user.organizationId,
        userId: user.sub,
        request: body,
      });
      return { data: result };
    } catch (err) {
      if (err instanceof ResearchQueryNotFoundError) {
        throw new NotFoundException(err.message);
      }
      throw err;
    }
  }
}
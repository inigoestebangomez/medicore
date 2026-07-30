// apps/api/src/api/research/export-v3.controller.ts
// Export V3 endpoints (M7). Gated by RESEARCH_V3_EXPORT, RBAC EXPORT_PATIENT.
//
//   POST /research/export/v3            accepts formats[], study payload → {jobId}
//   GET  /research/export/v3/:jobId       poll job status
//   GET  /research/export/v3/:jobId/download  download artifact
//
// Parallel to the V2 export controller — does NOT share state or routes with
// PdfProcessor / ExportV2Handler.

import {
  Controller, Post, Get, Body, Param, Res, HttpCode, Query, BadRequestException, NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { FeatureFlagGuard, RequireFeature } from '@/infrastructure/config/feature-flag.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { Action } from '@/domain/shared/rbac-permissions';
import {
  ExportV3Handler, type ExportV3Request, type ExportFormat,
} from '@/application/research/export/export-v3.handler';
import { ExportV3StatusHandler } from '@/application/research/queries/export-v3-status.handler';
import { ExportV3DownloadHandler } from '@/application/research/queries/export-v3-download.handler';

@Controller('research/export')
@UseGuards(AuthGuard, RBACGuard, FeatureFlagGuard)
export class ExportV3Controller {
  constructor(
    private readonly exportHandler: ExportV3Handler,
    private readonly statusHandler: ExportV3StatusHandler,
    private readonly downloadHandler: ExportV3DownloadHandler,
  ) {}

  @Post('v3')
  @HttpCode(200)
  @RequireFeature('RESEARCH_V3_EXPORT')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.EXPORT_PATIENT)
  async create(@Body() body: ExportV3Request & { formats?: ExportFormat[] }) {
    if (!body?.studyName) throw new BadRequestException('studyName is required');
    const formats = body.formats ?? [];
    if (formats.length === 0) throw new BadRequestException('formats is required');
    const result = await this.exportHandler.execute({ ...body, formats });
    return { data: result };
  }

  @Get('v3/:jobId')
  @RequireFeature('RESEARCH_V3_EXPORT')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.EXPORT_PATIENT)
  status(@Param('jobId') jobId: string) {
    return { data: this.statusHandler.execute(jobId) };
  }

  @Get('v3/:jobId/download')
  @RequireFeature('RESEARCH_V3_EXPORT')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.EXPORT_PATIENT)
  download(
    @Param('jobId') jobId: string,
    @Res({ passthrough: true }) res: Response,
    @Query('inline') inline?: string,
  ) {
    const { ok, buffer, filename, mimeType } = this.downloadHandler.execute(jobId);
    if (!ok || !buffer) throw new NotFoundException('job not found or no buffer');
    res.setHeader('Content-Type', mimeType ?? 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${inline === '1' ? 'inline' : 'attachment'}; filename="${filename ?? 'export'}"`,
    );
    res.send(buffer);
    return;
  }
}
// apps/api/src/api/research/stats-v3.controller.ts
// Stats V3 endpoints (M2 + M3). Gated by RESEARCH_V3_TABLE1 and
// RESEARCH_V3_PRE_POST respectively.
//
//   POST /research/stats/normality         Shapiro-Wilk (Python passthrough)
//   POST /research/table1                  single-cohort Table 1
//   POST /research/table1/compare          two-group Table 1 + p-value column
//   POST /research/analysis/pre-post       pre/post pairedWilcoxon analysis

import {
  Controller, Post, Body,
  UseGuards, BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { FeatureFlagGuard, RequireFeature } from '@/infrastructure/config/feature-flag.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import { Action } from '@/domain/shared/rbac-permissions';
import type { JwtPayload } from '@medicore/contracts';
import { PythonStatsService } from '@/infrastructure/stats/python-stats.service';
import { TableOneHandler } from '@/application/research/commands/table-one.handler';
import { TableOneCompareHandler } from '@/application/research/commands/table-one.handler';
import { PrePostAnalysisHandler, type PrePostCommand } from '@/application/research/commands/pre-post-analysis.handler';

@Controller('research')
@UseGuards(AuthGuard, RBACGuard, FeatureFlagGuard)
export class StatsV3Controller {
  constructor(
    private readonly pythonStats: PythonStatsService,
    private readonly tableOne: TableOneHandler,
    private readonly tableOneCompare: TableOneCompareHandler,
    private readonly prePost: PrePostAnalysisHandler,
  ) {}

  @Post('stats/normality')
  @RequireFeature('RESEARCH_V3_TABLE1')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async normality(@Body() body: { values?: number[]; alpha?: number }) {
    if (!body?.values || body.values.length === 0) throw new BadRequestException('values is required');
    try {
      const result = await this.pythonStats.runNormality(body.values, body.alpha ?? 0.05);
      return { data: result };
    } catch (err) {
      return { data: { statistic: null, pValue: null, isNormal: false, n: body.values.length, warnings: [(err as Error).message] } };
    }
  }

  @Post('table1')
  @RequireFeature('RESEARCH_V3_TABLE1')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async table1(
    @Body() body: { studyId?: string; queryId?: string; fields: string[]; groupBy?: string; overrides?: Record<string, 'mean_sd' | 'median_iqr'> },
    @CurrentUser() user: JwtPayload,
  ) {
    if (!body?.fields || body.fields.length === 0) throw new BadRequestException('fields is required');
    const result = await this.tableOne.execute({
      studyId: body.studyId,
      queryId: body.queryId,
      organizationId: user.organizationId,
      fields: body.fields,
      groupBy: body.groupBy,
      overrides: body.overrides,
    });
    return { data: result };
  }

  @Post('table1/compare')
  @RequireFeature('RESEARCH_V3_TABLE1')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async table1Compare(
    @Body() body: { studyId?: string; queryId?: string; fields: string[]; groupBy: string; overrides?: Record<string, 'mean_sd' | 'median_iqr'> },
    @CurrentUser() user: JwtPayload,
  ) {
    if (!body?.groupBy) throw new BadRequestException('groupBy is required for comparison');
    if (!body?.fields || body.fields.length === 0) throw new BadRequestException('fields is required');
    const result = await this.tableOneCompare.execute({
      studyId: body.studyId,
      queryId: body.queryId,
      organizationId: user.organizationId,
      fields: body.fields,
      groupBy: body.groupBy,
      overrides: body.overrides,
    });
    return { data: result };
  }

  @Post('analysis/pre-post')
  @RequireFeature('RESEARCH_V3_PRE_POST')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async runPrePost(
    @Body() body: Omit<PrePostCommand, 'organizationId'>,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!body?.studyId) throw new BadRequestException('studyId is required');
    if (!body?.scaleType) throw new BadRequestException('scaleType is required');
    const result = await this.prePost.execute({ ...body, organizationId: user.organizationId });
    return { data: result };
  }
}
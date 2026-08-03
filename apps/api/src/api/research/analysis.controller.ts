// apps/api/src/api/research/analysis.controller.ts
// AnalysisController (V4) — run + list analyses (REQ-FB-010, REQ-FB-012), the
// registration form mapper (REQ-FB-007), and the auto-fill map opt-out
// (REQ-FB-009). The registration form and auto-fill share the study-level
// prefix `research/studies` so this controller is mounted at that base to
// serve the non-subject study-scoped V4 routes.
//
//   GET    /research/studies/:id/registration-form   FormTemplate from vars
//   POST   /research/studies/:id/analyses             run a statistical test
//   GET    /research/studies/:id/analyses              list analysis history
//   PATCH  /research/studies/:id/auto-fill            update auto-fill map

import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { FeatureFlagGuard, RequireFeature } from '@/infrastructure/config/feature-flag.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import { Action } from '@/domain/shared/rbac-permissions';
import type { JwtPayload } from '@medicore/contracts';
import { RunAnalysisInputSchema, UpdateAutoFillMapInputSchema } from '@medicore/contracts';
import { RunAnalysisHandler, ListAnalysesHandler } from '@/application/research/commands/analysis.handler';
import { GetRegistrationFormHandler } from '@/application/research/queries/get-registration-form.handler';
import { UpdateAutoFillMapHandler } from '@/application/research/commands/subject.handlers';
import { StudyNotFoundError } from '@/domain/research/errors/study-not-found.error';

@Controller('research/studies/:id')
@RequireFeature('RESEARCH_FORM_BUILDER')
@UseGuards(AuthGuard, RBACGuard, FeatureFlagGuard)
export class AnalysisController {
  constructor(
    private readonly runAnalysis: RunAnalysisHandler,
    private readonly listAnalyses: ListAnalysesHandler,
    private readonly getRegistrationForm: GetRegistrationFormHandler,
    private readonly updateAutoFillMap: UpdateAutoFillMapHandler,
  ) {}

  @Get('registration-form')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async registrationForm(@Param('id') studyId: string, @CurrentUser() user: JwtPayload) {
    try {
      const template = await this.getRegistrationForm.execute({
        organizationId: user.organizationId, studyId,
      });
      return { data: { studyId, template } };
    } catch (err) {
      if (err instanceof StudyNotFoundError) throw new NotFoundException(err.message);
      throw err;
    }
  }

  @Post('analyses')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async run(@Param('id') studyId: string, @Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = RunAnalysisInputSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.message);
    const a = await this.runAnalysis.execute({
      organizationId: user.organizationId, studyId, input: input.data,
    });
    return { data: this.toResponse(a) };
  }

  @Get('analyses')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async list(@Param('id') studyId: string, @Query() _q: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    const items = await this.listAnalyses.execute({ organizationId: user.organizationId, studyId });
    return { data: items.map((a) => this.toResponse(a)) };
  }

  @Patch('auto-fill')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async autoFill(@Param('id') studyId: string, @Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = UpdateAutoFillMapInputSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.message);
    // subjectId in body — auto-fill is a per-subject snapshot.
    const subjectId = (body as any)?.subjectId;
    if (!subjectId) throw new BadRequestException('subjectId is required');
    const s = await this.updateAutoFillMap.execute({
      organizationId: user.organizationId, studyId, subjectId,
      autoFillMap: input.data.autoFillMap, optOutFields: input.data.optOutFields,
    });
    return { data: { autoFillMap: s.autoFillMap } };
  }

  private toResponse(a: import('@/domain/research/statistical-analysis.entity').StatisticalAnalysis) {
    return {
      id: a.id, organizationId: a.organizationId, studyId: a.studyId,
      test: a.test, variableIds: a.variableIds, params: a.params,
      statistic: a.statistic, pValue: a.pValue, ci95: a.ci95,
      effectSize: a.effectSize, n: a.n, riskLabel: a.riskLabel?.value ?? null,
      executedAt: a.executedAt.toISOString(),
    };
  }
}
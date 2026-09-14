// apps/api/src/api/research/guided-analysis.controller.ts
// POST /research/guided/analyses — authenticated, RBAC-protected, feature-flagged.
// Accepts a GuidedAnalysisRequest and returns a GuidedAnalysisResult.
// Behind the RESEARCH_GUIDED_ANALYSIS feature flag (default OFF for gradual rollout).

import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type { JwtPayload } from '@medicore/contracts';
import { FeatureFlagGuard, RequireFeature } from '@/infrastructure/config/feature-flag.guard';
import { GuidedAnalysisService, InvalidCohortError } from '@/application/research/services/guided-analysis.service';
import type { GuidedAnalysisResult } from '@medicore/contracts';
import { GuidedAnalysisRequestSchema } from '@medicore/contracts';
import { Action } from '@/domain/shared/rbac-permissions';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';

@Controller('research/guided')
@UseGuards(AuthGuard, RBACGuard, FeatureFlagGuard)
@RequireFeature('RESEARCH_GUIDED_ANALYSIS')
export class GuidedAnalysisController {
  constructor(private readonly guidedAnalysis: GuidedAnalysisService) {}

  @Post('analyses')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async runAnalysis(
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ data: GuidedAnalysisResult }> {
    // Validate request shape
    const parsed = GuidedAnalysisRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(`Invalid guided analysis request: ${parsed.error.message}`);
    }

    try {
      const result = await this.guidedAnalysis.execute(parsed.data, user.organizationId);
      return { data: result };
    } catch (err) {
      if (err instanceof InvalidCohortError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }
}

// apps/api/src/api/analytics/analytics.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type { JwtPayload } from '@medicore/contracts';
import type {
  IAnalyticsRepository,
  DashboardStats,
} from '@/domain/analytics/analytics.repository.interface';
import { Action } from '@/domain/shared/rbac-permissions';
import { GetOverviewUseCase } from '@/application/analytics/get-overview.use-case';
import { GetDiagnosisDistributionUseCase } from '@/application/analytics/get-diagnosis-distribution.use-case';
import { GetScaleEvolutionUseCase } from '@/application/analytics/get-scale-evolution.use-case';

@Controller('analytics')
@UseGuards(AuthGuard, RBACGuard)
export class AnalyticsController {
  private readonly getOverviewUseCase: GetOverviewUseCase;
  private readonly getDiagnosisDistributionUseCase: GetDiagnosisDistributionUseCase;
  private readonly getScaleEvolutionUseCase: GetScaleEvolutionUseCase;
  private readonly analyticsRepo: IAnalyticsRepository;

  constructor(
    @Inject('IAnalyticsRepository') analyticsRepo: IAnalyticsRepository,
  ) {
    this.analyticsRepo = analyticsRepo;
    this.getOverviewUseCase = new GetOverviewUseCase(analyticsRepo);
    this.getDiagnosisDistributionUseCase = new GetDiagnosisDistributionUseCase(analyticsRepo);
    this.getScaleEvolutionUseCase = new GetScaleEvolutionUseCase(analyticsRepo);
  }

  @Get('overview')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_ANALYTICS)
  async getOverview(
    @Query() query: any,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.getOverviewUseCase.execute({
      organizationId: user.organizationId,
      from: query.from,
      to: query.to,
    });
    return { data: result };
  }

  @Get('diagnoses')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_ANALYTICS)
  async getDiagnosisDistribution(
    @Query() query: any,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.getDiagnosisDistributionUseCase.execute({
      organizationId: user.organizationId,
      from: query.from,
      to: query.to,
      system: query.system,
      limit: query.limit ? Number(query.limit) : undefined,
    });
    return { data: result };
  }

  @Get('scales/:scaleType')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_ANALYTICS)
  async getScaleEvolution(
    @Param('scaleType') scaleType: string,
    @Query() query: any,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.getScaleEvolutionUseCase.execute({
      organizationId: user.organizationId,
      scaleType,
      from: query.from,
      to: query.to,
      diagnosisCode: query.diagnosisCode,
    });
    return { data: result };
  }

  @Get('dashboard')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_ANALYTICS)
  async dashboard(@CurrentUser() user: JwtPayload): Promise<{ data: DashboardStats }> {
    const stats = await this.analyticsRepo.getDashboardStats(user.organizationId);
    return { data: stats };
  }
}

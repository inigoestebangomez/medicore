// apps/api/src/api/research/analytics.controller.ts
// Analytical endpoints (spec §1, §2, §3):
//   GET  /research/cross-tab?row=&col=&queryId=        Cross-tab
//   GET  /research/time-series?metric=&period=&queryId= Time-series
//   POST /research/stats/inferential                   Inferential test via Python
//
// Cohort filtering is shared: the ad-hoc execution pipeline produces patient
// IDs, and the services read the requested fields from those patients. Inferential
// tests delegate to PythonStatsService with graceful degradation (BR-RES-005).

import {
  Controller, Get, Post, Body, Query,
  UseGuards, Inject, BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { FeatureFlagGuard, RequireFeature } from '@/infrastructure/config/feature-flag.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type {
  JwtPayload, Filter, FilterLogic, DataSource, CrossTabResult,
  TimeSeriesResult, TimeSeriesPeriod, InferentialRequest, StatisticalTestResult,
} from '@medicore/contracts';
import { Action } from '@/domain/shared/rbac-permissions';
import type { IResearchQueryRepository } from '@/domain/research/research-query.repository.interface';
import { CrossTabService } from '@/application/research/services/cross-tab.service';
import { TimeSeriesService } from '@/application/research/services/time-series.service';
import { FilterBuilderService } from '@/application/research/services/filter-builder.service';
import { JsonbSearchService } from '@/application/research/services/jsonb-search.service';
import { PythonStatsService } from '@/infrastructure/stats/python-stats.service';

@Controller('research')
@RequireFeature('RESEARCH_V2_STATS_SERVICE')
@UseGuards(AuthGuard, RBACGuard, FeatureFlagGuard)
export class AnalyticsController {
  constructor(
    @Inject('IResearchQueryRepository') private readonly queryRepo: IResearchQueryRepository,
    private readonly crossTabService: CrossTabService,
    private readonly timeSeriesService: TimeSeriesService,
    private readonly filterBuilder: FilterBuilderService,
    private readonly jsonbSearch: JsonbSearchService,
    private readonly pythonStats: PythonStatsService,
  ) {}

  // ─────────────────────────────────────────────
  // Cross-tabulation (spec §2)
  // ─────────────────────────────────────────────

  @Get('cross-tab')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async getCrossTab(
    @Query('row') row: string,
    @Query('col') col: string,
    @Query('queryId') queryId: string,
    @Query('dataSource') dataSource: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ data: CrossTabResult }> {
    if (!row || !col) throw new BadRequestException('row and col query params are required');
    const patients = await this.cohort(user, queryId, dataSource as DataSource);
    const pairs = patients.map((p: any) => ({
      rowValue: this.extractField(p, row),
      colValue: this.extractField(p, col),
    }));
    const result = this.crossTabService.compute(pairs, row, col);
    return { data: result };
  }

  // ─────────────────────────────────────────────
  // Time-series (spec §3)
  // ─────────────────────────────────────────────

  @Get('time-series')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async getTimeSeries(
    @Query('metric') metric: string,
    @Query('period') period: string,
    @Query('queryId') queryId: string,
    @Query('dateField') dateField: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ data: TimeSeriesResult }> {
    if (!metric) throw new BadRequestException('metric is required');
    const patients = await this.cohort(user, queryId, 'all_patients');
    const dateFieldResolved = dateField || 'createdAt';
    const events = patients
      .map((p: any) => ({ date: this.extractField(p, dateFieldResolved) as string | Date | null }))
      .filter((e): e is { date: string | Date } => e.date !== null && e.date !== undefined);
    const result = this.timeSeriesService.compute(events, metric, (period as TimeSeriesPeriod) ?? 'month');
    return { data: result };
  }

  // ─────────────────────────────────────────────
  // Inferential test (spec §1, BR-RES-005) — async via BullMQ + graceful degradation
  // ─────────────────────────────────────────────

  @Post('stats/inferential')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async inferential(
    @Body() body: InferentialRequest & {
      queryId?: string;
      groupField?: string;
      valueField?: string;
      filters?: Filter[];
      filterLogic?: FilterLogic;
      dataSource?: DataSource;
    },
  ): Promise<{ data: StatisticalTestResult | { warnings: string[] } }> {
    try {
      const result = await this.pythonStats.runInferential(body.test, body);
      return { data: result };
    } catch (err) {
      // Graceful degradation — never 5xx (design). Return a warning envelope.
      return {
        data: {
          test: body.test,
          statistic: null,
          pValue: null,
          ci95Lower: null,
          ci95Upper: null,
          effectSize: null,
          degreesFreedom: null,
          assumptionsChecked: [],
          warnings: [
            {
              code: 'inferential_stats_unavailable',
              message: (err as Error).message,
            },
          ],
        } as StatisticalTestResult,
      };
    }
  }

  // ─────────────────────────────────────────────
  // Cohort fetch (shared by cross-tab + time-series)
  // ─────────────────────────────────────────────

  private async cohort(
    user: JwtPayload,
    queryId: string | undefined,
    dataSource: DataSource,
  ): Promise<any[]> {
    let filters: Filter[] = [];
    let filterLogic: FilterLogic = 'AND';
    let importBatchIds: string[] = [];
    if (queryId) {
      const q = await this.queryRepo.findById(queryId, user.organizationId);
      if (q) {
        filters = q.filters;
        filterLogic = q.filterLogic;
        importBatchIds = q.importBatchIds;
        dataSource = q.dataSource;
      }
    }
    const { where, rawFilters } = this.filterBuilder.build(filters, filterLogic, user.organizationId);
    const scoped = this.applyDataSourceScope(where, dataSource, importBatchIds);
    const prisma = (this.jsonbSearch as any).prisma as any;
    const patients = await prisma.patient.findMany({
      where: scoped,
      select: {
        id: true, nhc: true, firstName: true, lastName: true, birthDate: true,
        sex: true, bloodType: true, importSource: true, importedData: true,
        importBatchId: true, createdAt: true,
      },
    });
    if (rawFilters.length > 0) {
      const ids = await this.jsonbSearch.applyRawFilters(
        user.organizationId,
        patients.map((p: any) => p.id),
        rawFilters,
      );
      const idSet = new Set(ids);
      return patients.filter((p: any) => idSet.has(p.id));
    }
    return patients;
  }

  private applyDataSourceScope(where: any, dataSource: DataSource, importBatchIds: string[]): any {
    switch (dataSource) {
      case 'manual_only':
        return { ...where, importSource: null };
      case 'imported_only':
        return { ...where, NOT: { importSource: null } };
      case 'import_batch':
        return importBatchIds.length > 0
          ? { ...where, importBatchId: { in: importBatchIds } }
          : where;
      default:
        return where;
    }
  }

  private extractField(patient: any, field: string): string | null {
    if (field === 'age' && patient.birthDate) {
      const diff = Date.now() - new Date(patient.birthDate).getTime();
      return String(Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
    }
    const standardFields = ['nhc', 'firstName', 'lastName', 'birthDate', 'sex', 'bloodType', 'importSource', 'createdAt'];
    if (standardFields.includes(field)) return patient[field] != null ? String(patient[field]) : null;
    if (patient.importedData) {
      for (const batchKey of Object.keys(patient.importedData)) {
        const batch = patient.importedData[batchKey];
        if (batch && typeof batch === 'object' && field in batch) {
          const v = batch[field];
          return v == null ? null : (v instanceof Date ? v.toISOString() : String(v));
        }
      }
    }
    return null;
  }
}
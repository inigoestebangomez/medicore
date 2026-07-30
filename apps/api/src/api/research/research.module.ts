// apps/api/src/api/research/research.module.ts
// Wires the Research Engine (v1 + V2): controllers, use case handlers,
// application services, and the Prisma repositories bounded to their interface
// DI tokens (Clean Architecture — handlers stay infrastructure-agnostic).
//
// Research Engine V2 additions: Dashboard aggregate + repository, field
// discovery service + cache port, ad-hoc execution handler, and the new
// controllers (fields, execute, dashboard, analytics, sharing, export-v2).

import { Module } from '@nestjs/common';
import { ResearchController } from './research.controller';
import { FieldsController } from './fields.controller';
import { ExecuteController } from './execute.controller';
import { DashboardController } from './dashboard.controller';
import { AnalyticsController } from './analytics.controller';
import { SharingController } from './sharing.controller';
import { ExportV2Controller } from './export.controller';
import { StudiesController } from './studies.controller';
import { StatsV3Controller } from './stats-v3.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { PrismaResearchQueryRepository } from '@/infrastructure/database/repositories/research-query.repository';
import { PrismaPatientCollectionRepository } from '@/infrastructure/database/repositories/patient-collection.repository';
import { PrismaPatientRepository } from '@/infrastructure/database/repositories/patient.repository';
import { PrismaDashboardRepository } from '@/infrastructure/database/repositories/dashboard.repository';
import { FilterBuilderService } from '@/application/research/services/filter-builder.service';
import { JsonbSearchService } from '@/application/research/services/jsonb-search.service';
import { StatsCalculatorService } from '@/application/research/services/stats-calculator.service';
import { FieldDiscoveryService } from '@/application/research/services/field-discovery.service';
import { CrossTabService } from '@/application/research/services/cross-tab.service';
import { TimeSeriesService } from '@/application/research/services/time-series.service';
import { VisibilityShareService } from '@/application/research/services/visibility-share.service';
import { InMemoryFieldCatalogCache } from '@/infrastructure/research/in-memory-field-catalog-cache';
import { PythonStatsService } from '@/infrastructure/stats/python-stats.service';
import { CircuitBreaker } from '@/infrastructure/stats/circuit-breaker';
import { SaveQueryHandler } from '@/application/research/commands/save-research-query.handler';
import { CreateCollectionHandler } from '@/application/research/commands/create-collection.handler';
import { AddToCollectionHandler } from '@/application/research/commands/add-to-collection.handler';
import { LockCollectionHandler } from '@/application/research/commands/lock-collection.handler';
import { ExportResultsHandler } from '@/application/research/commands/export-collection.handler';
import { GetQueryHistoryHandler } from '@/application/research/queries/get-query-history.handler';
import { ExecuteResearchQueryHandler } from '@/application/research/queries/execute-research-query.handler';
import { ExecuteAdHocQueryHandler } from '@/application/research/queries/execute-adhoc-query.handler';
import { DashboardCommandHandler } from '@/application/research/commands/dashboard.handler';
import { ExportV2Handler } from '@/application/research/commands/export-v2.handler';
import { AuditModule } from '@/infrastructure/audit/audit.module';
import { AuthModule } from '@/api/auth/auth.module';
import { ResearchStatsModule } from '@/infrastructure/stats/stats.module';
import { PdfQueueModule } from '@/infrastructure/queues/pdf.module';
import { FeatureFlagsService } from '@/infrastructure/config/feature-flags.service';
import { FeatureFlagGuard } from '@/infrastructure/config/feature-flag.guard';
import { PrismaResearchStudyRepository } from '@/infrastructure/database/repositories/research-study.repository';
import { PrismaStudyNotificationRepository } from '@/infrastructure/database/repositories/study-notification.repository';
import { CreateStudyHandler } from '@/application/research/commands/create-study.handler';
import { UpdateStudyHandler } from '@/application/research/commands/update-study.handler';
import { FreezeStudyHandler } from '@/application/research/commands/freeze-study.handler';
import { ArchiveStudyHandler } from '@/application/research/commands/archive-study.handler';
import { ReactivateStudyHandler } from '@/application/research/commands/reactivate-study.handler';
import { RecalculateStudyHandler } from '@/application/research/commands/recalculate-study.handler';
import { ListStudiesHandler } from '@/application/research/queries/list-studies.handler';
import { GetStudyHandler } from '@/application/research/queries/get-study.handler';
import { ListNotificationsHandler } from '@/application/research/queries/list-notifications.handler';
import { GetSuggestionsHandler } from '@/application/research/queries/get-suggestions.handler';
import { StudyLifecycleService } from '@/application/research/services/study-lifecycle.service';
import { StudySuggestionService } from '@/application/research/services/study-suggestion.service';
import { TableOneService } from '@/application/research/services/table-one.service';
import { TableOneHandler, TableOneCompareHandler } from '@/application/research/commands/table-one.handler';
import { PrePostAnalysisService } from '@/application/research/services/pre-post-analysis.service';
import { PrePostAnalysisHandler } from '@/application/research/commands/pre-post-analysis.handler';
import { GroupComparisonService } from '@/application/research/services/group-comparison.service';
import { GroupComparisonHandler } from '@/application/research/commands/group-comparison.handler';
import { SurvivalTableService } from '@/application/research/services/survival-table.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuditModule,
    ResearchStatsModule,
    PdfQueueModule,
    // The `stats` queue is registered by ResearchStatsModule; the `pdf.render`
    // queue is registered by PdfQueueModule. No duplicate registration here.
  ],
  controllers: [
    ResearchController,
    FieldsController,
    ExecuteController,
    DashboardController,
    AnalyticsController,
    SharingController,
    ExportV2Controller,
    StudiesController,
    StatsV3Controller,
  ],
  providers: [
    // Repositories (interface-typed DI tokens).
    { provide: 'IResearchQueryRepository', useClass: PrismaResearchQueryRepository },
    { provide: 'IPatientCollectionRepository', useClass: PrismaPatientCollectionRepository },
    { provide: 'IPatientRepository', useClass: PrismaPatientRepository },
    { provide: 'IDashboardRepository', useClass: PrismaDashboardRepository },
    // Field catalog cache port (AD-3) — in-memory default, swappable for Redis.
    { provide: 'FieldCatalogCachePort', useClass: InMemoryFieldCatalogCache },
    // Application services.
    FilterBuilderService,
    JsonbSearchService,
    StatsCalculatorService,
    FieldDiscoveryService,
    CrossTabService,
    TimeSeriesService,
    VisibilityShareService,
    // Use case handlers.
    SaveQueryHandler,
    CreateCollectionHandler,
    AddToCollectionHandler,
    LockCollectionHandler,
    ExportResultsHandler,
    GetQueryHistoryHandler,
    ExecuteResearchQueryHandler,
    ExecuteAdHocQueryHandler,
    DashboardCommandHandler,
    ExportV2Handler,
    // Research V3 — study lifecycle (M8).
    CreateStudyHandler,
    UpdateStudyHandler,
    FreezeStudyHandler,
    ArchiveStudyHandler,
    ReactivateStudyHandler,
    RecalculateStudyHandler,
    ListStudiesHandler,
    GetStudyHandler,
    ListNotificationsHandler,
    GetSuggestionsHandler,
    // Infrastructure stats (Python microservice client).
    PythonStatsService,
    CircuitBreaker,
    FeatureFlagsService,
    FeatureFlagGuard,
    // Research V3 — study repositories (interface-typed DI tokens).
    { provide: 'IResearchStudyRepository', useClass: PrismaResearchStudyRepository },
    { provide: 'IStudyNotificationRepository', useClass: PrismaStudyNotificationRepository },
    // Research V3 — study services.
    StudyLifecycleService,
    StudySuggestionService,
    // Research V3 — table 1 + pre/post (M2/M3).
    TableOneService,
    TableOneHandler,
    TableOneCompareHandler,
    PrePostAnalysisService,
    PrePostAnalysisHandler,
    // Research V3 — group comparison (M6).
    GroupComparisonService,
    GroupComparisonHandler,
    // Research V3 — survival table export (M5).
    SurvivalTableService,
    // BullMQ queue token for the PDF render worker (design AD-4).
    {
      provide: 'PDF_QUEUE',
      useFactory: (queue: any) => queue,
      inject: ['BullQueue_pdf.render'],
    },
  ],
  exports: [
    FieldDiscoveryService,
    CrossTabService,
    TimeSeriesService,
    PythonStatsService,
  ],
})
export class ResearchModule {}
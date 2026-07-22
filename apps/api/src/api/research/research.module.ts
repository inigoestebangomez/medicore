// apps/api/src/api/research/research.module.ts
// Wires the Research Engine: controller, use case handlers, application
// services, and the Prisma repositories bounded to their interfaces via DI
// tokens (handlers stay infrastructure-agnostic).
//
// Repositories are bound to the string DI tokens the handlers inject
// ('IResearchQueryRepository', 'IPatientCollectionRepository'). Patient
// access for the execute pipeline reuses the shared IPatientRepository,
// already provided by PrismaModule — the handler reads it via the injected
// patient repo's Prisma connection.

import { Module } from '@nestjs/common';
import { ResearchController } from './research.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { PrismaResearchQueryRepository } from '@/infrastructure/database/repositories/research-query.repository';
import { PrismaPatientCollectionRepository } from '@/infrastructure/database/repositories/patient-collection.repository';
import { PrismaPatientRepository } from '@/infrastructure/database/repositories/patient.repository';
import { FilterBuilderService } from '@/application/research/services/filter-builder.service';
import { JsonbSearchService } from '@/application/research/services/jsonb-search.service';
import { StatsCalculatorService } from '@/application/research/services/stats-calculator.service';
import { SaveQueryHandler } from '@/application/research/commands/save-research-query.handler';
import { CreateCollectionHandler } from '@/application/research/commands/create-collection.handler';
import { AddToCollectionHandler } from '@/application/research/commands/add-to-collection.handler';
import { LockCollectionHandler } from '@/application/research/commands/lock-collection.handler';
import { ExportResultsHandler } from '@/application/research/commands/export-collection.handler';
import { GetQueryHistoryHandler } from '@/application/research/queries/get-query-history.handler';
import { ExecuteResearchQueryHandler } from '@/application/research/queries/execute-research-query.handler';
import { AuthModule } from '@/api/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ResearchController],
  providers: [
    // Repositories (interface-typed DI tokens).
    { provide: 'IResearchQueryRepository', useClass: PrismaResearchQueryRepository },
    { provide: 'IPatientCollectionRepository', useClass: PrismaPatientCollectionRepository },
    { provide: 'IPatientRepository', useClass: PrismaPatientRepository },
    // Application services.
    FilterBuilderService,
    JsonbSearchService,
    StatsCalculatorService,
    // Use case handlers.
    SaveQueryHandler,
    CreateCollectionHandler,
    AddToCollectionHandler,
    LockCollectionHandler,
    ExportResultsHandler,
    GetQueryHistoryHandler,
    ExecuteResearchQueryHandler,
  ],
  exports: [],
})
export class ResearchModule {}
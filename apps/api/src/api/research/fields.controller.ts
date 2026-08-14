// apps/api/src/api/research/fields.controller.ts
// Field discovery endpoint (spec §5, design AD-3).
// GET /research/fields?q=&type= → FieldDiscoveryService (cached catalog).

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { FeatureFlagGuard, RequireFeature } from '@/infrastructure/config/feature-flag.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type { JwtPayload, FieldType } from '@medicore/contracts';
import { Action } from '@/domain/shared/rbac-permissions';
import { FieldDiscoveryService } from '@/application/research/services/field-discovery.service';

@Controller('research')
@RequireFeature('RESEARCH_V2_FIELD_DISCOVERY')
@UseGuards(AuthGuard, RBACGuard, FeatureFlagGuard)
export class FieldsController {
  constructor(private readonly fieldDiscovery: FieldDiscoveryService) {}

  @Get('fields')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async getFields(
    @Query('q') q: string,
    @Query('type') type: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const typed = type ? (type as FieldType) : undefined;
    const catalog = await this.fieldDiscovery.getCatalogResponse(user.organizationId, q ?? '', typed);
    return { data: { query: q ?? '', type: typed, ...catalog } };
  }
}

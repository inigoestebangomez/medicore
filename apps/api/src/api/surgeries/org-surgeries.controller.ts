// apps/api/src/api/surgeries/org-surgeries.controller.ts
// Top-level org-wide surgeries endpoint: GET /v1/surgeries
// Existing patient-scoped routes live at patients/:patientId/surgeries (untouched).

import {
  Controller,
  Get,
  Query,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type { JwtPayload } from '@medicore/contracts';
import type { ISurgeryRepository } from '@/domain/surgery/surgery.repository.interface';
import { Action } from '@/domain/shared/rbac-permissions';
import { ListOrgSurgeriesUseCase } from '@/application/surgery/queries/list-org-surgeries.use-case';
import { ListOrgSurgeriesQuerySchema } from '@medicore/contracts';
import type { ListOrgSurgeriesResponse } from '@/application/surgery/queries/list-org-surgeries.use-case';

@Controller('surgeries')
@UseGuards(AuthGuard, RBACGuard)
export class OrgSurgeriesController {
  private readonly listOrgSurgeriesUseCase: ListOrgSurgeriesUseCase;

  constructor(@Inject('ISurgeryRepository') surgeryRepo: ISurgeryRepository) {
    this.listOrgSurgeriesUseCase = new ListOrgSurgeriesUseCase(surgeryRepo);
  }

  @Get()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_SURGERY)
  async list(
    @Query() query: any,
    @CurrentUser() user: JwtPayload,
  ): Promise<ListOrgSurgeriesResponse> {
    const parsed = ListOrgSurgeriesQuerySchema.parse(query);

    return this.listOrgSurgeriesUseCase.execute({
      organizationId: user.organizationId,
      page: parsed.page,
      pageSize: parsed.pageSize,
      from: parsed.from ? new Date(parsed.from) : undefined,
      to: parsed.to ? new Date(parsed.to) : undefined,
      status: parsed.status,
      physicianId: parsed.physicianId,
      sortBy: parsed.sortBy,
      sortOrder: parsed.sortOrder,
    });
  }
}
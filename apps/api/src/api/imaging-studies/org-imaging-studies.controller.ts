// apps/api/src/api/imaging-studies/org-imaging-studies.controller.ts
// Top-level org-wide imaging endpoint: GET /v1/imaging-studies
// Existing patient-scoped routes live at patients/:patientId/imaging (untouched).

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
import type { IImagingStudyRepository } from '@/domain/imaging/imaging-study.repository.interface';
import { Action } from '@/domain/shared/rbac-permissions';
import { ListOrgImagingStudiesUseCase } from '@/application/imaging/queries/list-org-imaging-studies.use-case';
import { ListOrgImagingStudiesQuerySchema } from '@medicore/contracts';
import type { ListOrgImagingStudiesResponse } from '@/application/imaging/queries/list-org-imaging-studies.use-case';

@Controller('imaging-studies')
@UseGuards(AuthGuard, RBACGuard)
export class OrgImagingStudiesController {
  private readonly listOrgImagingStudiesUseCase: ListOrgImagingStudiesUseCase;

  constructor(@Inject('IImagingStudyRepository') imagingRepo: IImagingStudyRepository) {
    this.listOrgImagingStudiesUseCase = new ListOrgImagingStudiesUseCase(imagingRepo);
  }

  @Get()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_IMAGING)
  async list(
    @Query() query: any,
    @CurrentUser() user: JwtPayload,
  ): Promise<ListOrgImagingStudiesResponse> {
    const parsed = ListOrgImagingStudiesQuerySchema.parse(query);

    return this.listOrgImagingStudiesUseCase.execute({
      organizationId: user.organizationId,
      page: parsed.page,
      pageSize: parsed.pageSize,
      from: parsed.from ? new Date(parsed.from) : undefined,
      to: parsed.to ? new Date(parsed.to) : undefined,
      type: parsed.type,
      sortBy: parsed.sortBy,
      sortOrder: parsed.sortOrder,
    });
  }
}
// apps/api/src/api/research/studies.controller.ts
// StudiesController (M8) — ResearchStudy lifecycle endpoints.
// All gated by RESEARCH_V3_STUDIES (design). RBAC: READ_PATIENT; freeze
// additionally checks ownership (BR-RES-009) inside the handler.
//
//   POST   /research/studies                          create
//   GET    /research/studies                           list (status filter + pagination)
//   GET    /research/studies/:id                       detail
//   PATCH  /research/studies/:id                       update metadata
//   POST   /research/studies/:id/freeze                freeze (owner only)
//   POST   /research/studies/:id/reactivate            resume paused cohort
//   POST   /research/studies/:id/archive               pause live updates
//   POST   /research/studies/:id/recalculate           refresh cached cohort
//   GET    /research/studies/:id/notifications         notifications + unread badge
//   POST   /research/studies/:id/notifications/read     mark all read
//   GET    /research/studies/:id/suggestions            auto-suggestions

import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { FeatureFlagGuard, RequireFeature } from '@/infrastructure/config/feature-flag.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import { Action } from '@/domain/shared/rbac-permissions';
import type { JwtPayload } from '@medicore/contracts';
import {
  CreateStudyInputSchema, UpdateStudyInputSchema, ListStudiesQuerySchema,
} from '@/domain/research/contracts/study.contract';
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
import { StudyNotFoundError, StudyOwnershipError } from '@/domain/research/errors/study-not-found.error';

@Controller('research/studies')
@RequireFeature('RESEARCH_V3_STUDIES')
@UseGuards(AuthGuard, RBACGuard, FeatureFlagGuard)
export class StudiesController {
  constructor(
    private readonly createStudy: CreateStudyHandler,
    private readonly updateStudy: UpdateStudyHandler,
    private readonly freezeStudy: FreezeStudyHandler,
    private readonly archiveStudy: ArchiveStudyHandler,
    private readonly reactivateStudy: ReactivateStudyHandler,
    private readonly recalculateStudy: RecalculateStudyHandler,
    private readonly listStudies: ListStudiesHandler,
    private readonly getStudy: GetStudyHandler,
    private readonly listNotifications: ListNotificationsHandler,
    private readonly getSuggestions: GetSuggestionsHandler,
  ) {}

  @Post()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateStudyInputSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.message);
    const study = await this.createStudy.execute({
      organizationId: user.organizationId,
      createdBy: user.sub,
      input: input.data,
    });
    return { data: this.toResponse(study) };
  }

  @Get()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async list(@Query() query: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    const parsed = ListStudiesQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.message);
    const page = await this.listStudies.execute({
      organizationId: user.organizationId,
      status: parsed.data.status,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
    return {
      data: {
        items: page.items.map((s) => this.toResponse(s)),
        total: page.total,
        page: page.page,
        pageSize: page.pageSize,
      },
    };
  }

  @Get(':id')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async detail(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    try {
      const study = await this.getStudy.execute({ studyId: id, organizationId: user.organizationId });
      return { data: this.toResponse(study) };
    } catch (err) {
      if (err instanceof StudyNotFoundError) throw new NotFoundException(err.message);
      throw err;
    }
  }

  @Patch(':id')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = UpdateStudyInputSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.message);
    try {
      const study = await this.updateStudy.execute({ studyId: id, organizationId: user.organizationId, input: input.data });
      return { data: this.toResponse(study) };
    } catch (err) {
      if (err instanceof StudyNotFoundError) throw new NotFoundException(err.message);
      throw err;
    }
  }

  @Post(':id/freeze')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async freeze(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    try {
      const study = await this.freezeStudy.execute({ studyId: id, organizationId: user.organizationId, userId: user.sub });
      return { data: this.toResponse(study) };
    } catch (err) {
      if (err instanceof StudyNotFoundError) throw new NotFoundException(err.message);
      if (err instanceof StudyOwnershipError) throw new ForbiddenException(err.message);
      throw err;
    }
  }

  @Post(':id/reactivate')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async reactivate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    try {
      const study = await this.reactivateStudy.execute({ studyId: id, organizationId: user.organizationId });
      return { data: this.toResponse(study) };
    } catch (err) {
      if (err instanceof StudyNotFoundError) throw new NotFoundException(err.message);
      throw err;
    }
  }

  @Post(':id/archive')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async archive(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    try {
      const study = await this.archiveStudy.execute({ studyId: id, organizationId: user.organizationId });
      return { data: this.toResponse(study) };
    } catch (err) {
      if (err instanceof StudyNotFoundError) throw new NotFoundException(err.message);
      throw err;
    }
  }

  @Post(':id/recalculate')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async recalculate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    try {
      const study = await this.recalculateStudy.execute({ studyId: id, organizationId: user.organizationId });
      return { data: this.toResponse(study) };
    } catch (err) {
      if (err instanceof StudyNotFoundError) throw new NotFoundException(err.message);
      throw err;
    }
  }

  @Get(':id/notifications')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async notifications(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const res = await this.listNotifications.execute({
      studyId: id,
      organizationId: user.organizationId,
      userId: user.sub,
    });
    return {
      data: {
        notifications: res.notifications.map((n) => ({
          id: n.id,
          studyId: n.studyId,
          newPatientCount: n.newPatientCount,
          readAt: n.readAt?.toISOString() ?? null,
          createdAt: n.createdAt.toISOString(),
        })),
        unreadCount: res.unreadCount,
      },
    };
  }

  @Post(':id/notifications/read')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async markRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const marked = await this.listNotifications.markAllRead(id, user.sub);
    return { data: { markedRead: marked } };
  }

  @Get(':id/suggestions')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async suggestions(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const res = await this.getSuggestions.execute({ studyId: id, organizationId: user.organizationId });
    return { data: res };
  }

  private toResponse(s: import('@/domain/research/research-study.entity').ResearchStudy) {
    return {
      id: s.id,
      organizationId: s.organizationId,
      createdBy: s.createdBy,
      queryId: s.queryId,
      studyType: s.studyType,
      name: s.name,
      description: s.description,
      status: s.status.value,
      cachedPatientIds: s.cachedPatientIds,
      cachedAt: s.cachedAt?.toISOString() ?? null,
      patientCount: s.patientCount,
      analyses: s.analyses,
      publicationRef: s.publicationRef,
      frozenAt: s.frozenAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      isLive: s.status.isActive,
    };
  }
}
// apps/api/src/api/research/subject.controller.ts
// SubjectController (V4) — StudySubject enrollment + EHR auto-fill
// (REQ-FB-006, REQ-FB-009). Routes gating: RESEARCH_FORM_BUILDER + READ_PATIENT.
//
//   POST   /research/studies/:id/subjects/preview  EHR auto-fill preview
//   POST   /research/studies/:id/subjects            enroll subject
//   GET    /research/studies/:id/subjects             list subjects
//   PATCH  /research/studies/:id/subjects/:sid        update subject
//   PATCH  /research/studies/:id/auto-fill            update auto-fill map (opt-out)

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
import {
  StudySubjectInputSchema, StudySubjectUpdateSchema,
  AutoFillPreviewInputSchema,
} from '@medicore/contracts';
import {
  EnrollSubjectHandler, ListSubjectsHandler, UpdateSubjectHandler,
  PreviewAutoFillHandler,
} from '@/application/research/commands/subject.handlers';
import { StudyNotFoundError } from '@/domain/research/errors/study-not-found.error';

@Controller('research/studies/:id/subjects')
@RequireFeature('RESEARCH_FORM_BUILDER')
@UseGuards(AuthGuard, RBACGuard, FeatureFlagGuard)
export class SubjectController {
  constructor(
    private readonly enrollHandler: EnrollSubjectHandler,
    private readonly listSubjects: ListSubjectsHandler,
    private readonly updateSubject: UpdateSubjectHandler,
    private readonly previewAutoFill: PreviewAutoFillHandler,
  ) {}

  @Post('preview')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async preview(@Param('id') studyId: string, @Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = AutoFillPreviewInputSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.message);
    try {
      const res = await this.previewAutoFill.execute({
        organizationId: user.organizationId, studyId,
        patientId: input.data.patientId, autoFillMap: input.data.autoFillMap,
      });
      return { data: res };
    } catch (err) {
      if (err instanceof StudyNotFoundError) throw new NotFoundException(err.message);
      throw err;
    }
  }

  @Post()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async enroll(@Param('id') studyId: string, @Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = StudySubjectInputSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.message);
    try {
      const s = await this.enrollHandler.execute({
        organizationId: user.organizationId, studyId, enrolledBy: user.sub, input: input.data,
      });
      return { data: this.toResponse(s) };
    } catch (err) {
      if (err instanceof StudyNotFoundError) throw new NotFoundException(err.message);
      throw err;
    }
  }

  @Get()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async list(@Param('id') studyId: string, @Query() query: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const res = await this.listSubjects.execute({ organizationId: user.organizationId, studyId, page, pageSize });
    return {
      data: {
        items: res.items.map((s) => this.toResponse(s)),
        total: res.total, page: res.page, pageSize: res.pageSize,
      },
    };
  }

  @Patch(':sid')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async update(@Param('id') studyId: string, @Param('sid') subjectId: string, @Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = StudySubjectUpdateSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.message);
    try {
      const s = await this.updateSubject.execute({
        organizationId: user.organizationId, studyId, subjectId, input: input.data,
      });
      return { data: this.toResponse(s) };
    } catch (err) {
      if (err instanceof StudyNotFoundError) throw new NotFoundException(err.message);
      throw err;
    }
  }

  private toResponse(s: import('@/domain/research/study-subject.entity').StudySubject) {
    return {
      id: s.id, organizationId: s.organizationId, studyId: s.studyId,
      patientId: s.patientId, patientNhc: s.patientNhc, values: s.values,
      autoFillMap: s.autoFillMap, enrolledBy: s.enrolledBy,
      enrolledAt: s.enrolledAt.toISOString(), updatedAt: s.updatedAt.toISOString(),
    };
  }
}
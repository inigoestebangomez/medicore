// apps/api/src/api/research/variable-builder.controller.ts
// VariableBuilderController (V4) — variable definitions for a study (REQ-FB-001..005).
// Routes gating: RESEARCH_FORM_BUILDER flag + READ_PATIENT RBAC.
//
//   POST   /research/studies/:id/variables              create variable
//   PATCH  /research/studies/:id/variables/:vid          update metadata
//   DELETE /research/studies/:id/variables/:vid          delete (history preserved)
//   POST   /research/studies/:id/variables/reorder        reorder
//   POST   /research/studies/:id/variables/decompose      composite → N children
//   POST   /research/studies/:id/variables/from-template  snapshot copy (REQ-FB-002)

import {
  Controller, Get, Post, Patch, Delete, Body, Param,
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
  StudyVariableInputSchema, StudyVariableUpdateSchema,
  ReorderVariablesInputSchema, DecomposeInputSchema, AddFromTemplateInputSchema,
} from '@medicore/contracts';
import {
  CreateVariableHandler, UpdateVariableHandler, DeleteVariableHandler,
  ReorderVariablesHandler, DecomposeVariableHandler, AddVariableFromTemplateHandler,
  ListVariablesHandler,
} from '@/application/research/commands/variable-builder.handlers';
import { StudyNotFoundError } from '@/domain/research/errors/study-not-found.error';

@Controller('research/studies/:id/variables')
@RequireFeature('RESEARCH_FORM_BUILDER')
@UseGuards(AuthGuard, RBACGuard, FeatureFlagGuard)
export class VariableBuilderController {
  constructor(
    private readonly listVars: ListVariablesHandler,
    private readonly createVar: CreateVariableHandler,
    private readonly updateVar: UpdateVariableHandler,
    private readonly deleteVar: DeleteVariableHandler,
    private readonly reorderVars: ReorderVariablesHandler,
    private readonly decomposeVar: DecomposeVariableHandler,
    private readonly addFromTemplate: AddVariableFromTemplateHandler,
  ) {}

  @Get()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async list(@Param('id') studyId: string, @CurrentUser() user: JwtPayload) {
    const vars = await this.listVars.execute({ organizationId: user.organizationId, studyId });
    return { data: vars.map((v) => this.toResponse(v)) };
  }

  @Post()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async create(@Param('id') studyId: string, @Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = StudyVariableInputSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.message);
    try {
      const v = await this.createVar.execute({
        organizationId: user.organizationId, studyId, createdBy: user.sub, input: input.data,
      });
      return { data: this.toResponse(v) };
    } catch (err) {
      if (err instanceof StudyNotFoundError) throw new NotFoundException(err.message);
      throw err;
    }
  }

  @Patch(':vid')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async update(@Param('id') studyId: string, @Param('vid') variableId: string, @Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = StudyVariableUpdateSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.message);
    try {
      const v = await this.updateVar.execute({
        organizationId: user.organizationId, studyId, variableId, input: input.data,
      });
      return { data: this.toResponse(v) };
    } catch (err) {
      if (err instanceof StudyNotFoundError) throw new NotFoundException(err.message);
      throw err;
    }
  }

  @Delete(':vid')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async delete(@Param('id') studyId: string, @Param('vid') variableId: string, @CurrentUser() user: JwtPayload) {
    await this.deleteVar.execute({ organizationId: user.organizationId, variableId });
    void studyId;
    return { data: { deleted: true } };
  }

  @Post('reorder')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async reorder(@Param('id') studyId: string, @Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = ReorderVariablesInputSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.message);
    await this.reorderVars.execute({
      organizationId: user.organizationId, studyId, orderedIds: input.data.orderedIds,
    });
    return { data: { reordered: true } };
  }

  @Post('decompose')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async decompose(@Param('id') studyId: string, @Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = DecomposeInputSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.message);
    try {
      const children = await this.decomposeVar.execute({
        organizationId: user.organizationId, studyId,
        parentVariableId: input.data.parentVariableId,
        children: input.data.children,
      });
      return { data: children.map((c) => this.toResponse(c)) };
    } catch (err) {
      if (err instanceof StudyNotFoundError) throw new NotFoundException(err.message);
      throw err;
    }
  }

  @Post('from-template')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async fromTemplate(@Param('id') studyId: string, @Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = AddFromTemplateInputSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.message);
    try {
      const v = await this.addFromTemplate.execute({
        organizationId: user.organizationId, studyId, templateId: input.data.templateId,
      });
      return { data: this.toResponse(v) };
    } catch (err) {
      if (err instanceof StudyNotFoundError) throw new NotFoundException(err.message);
      throw err;
    }
  }

  private toResponse(v: import('@/domain/research/study-variable.entity').StudyVariable) {
    return {
      id: v.id, organizationId: v.organizationId, studyId: v.studyId,
      name: v.name, label: v.label, type: v.type.value, scope: v.scope.value,
      unit: v.unit, required: v.required, isCore: v.isCore, position: v.position,
      options: v.options, range: v.range, parentId: v.parentId,
      createdAt: v.createdAt.toISOString(), updatedAt: v.updatedAt.toISOString(),
    };
  }
}
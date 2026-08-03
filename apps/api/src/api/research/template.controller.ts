// apps/api/src/api/research/template.controller.ts
// TemplateController (V4) — org-level reusable variable library (REQ-FB-002).
// Editing a template never mutates studies that imported a snapshot copy.
// Routes gating: RESEARCH_VARIABLE_LIBRARY flag + READ_PATIENT RBAC.
//
//   GET   /research/variables/templates       list org templates
//   POST  /research/variables/templates       create template
//   PATCH /research/variables/templates/:id   update template metadata

import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { FeatureFlagGuard, RequireFeature } from '@/infrastructure/config/feature-flag.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import { Action } from '@/domain/shared/rbac-permissions';
import type { JwtPayload } from '@medicore/contracts';
import { VariableTemplateInputSchema } from '@medicore/contracts';
import {
  CreateVariableTemplateHandler,
  ListVariableTemplatesHandler,
  UpdateVariableTemplateHandler,
} from '@/application/research/commands/variable-template.handlers';

@Controller('research/variables/templates')
@RequireFeature('RESEARCH_VARIABLE_LIBRARY')
@UseGuards(AuthGuard, RBACGuard, FeatureFlagGuard)
export class TemplateController {
  constructor(
    private readonly createTpl: CreateVariableTemplateHandler,
    private readonly listTpls: ListVariableTemplatesHandler,
    private readonly updateTpl: UpdateVariableTemplateHandler,
  ) {}

  @Get()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async list(@Query() query: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const res = await this.listTpls.execute({
      organizationId: user.organizationId, page, pageSize,
    });
    return {
      data: {
        items: res.items.map((t) => this.toResponse(t)),
        total: res.total, page: res.page, pageSize: res.pageSize,
      },
    };
  }

  @Post()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = VariableTemplateInputSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.message);
    const t = await this.createTpl.execute({
      organizationId: user.organizationId, createdBy: user.sub, input: input.data,
    });
    return { data: this.toResponse(t) };
  }

  @Patch(':id')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async update(@Param('id') templateId: string, @Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = VariableTemplateInputSchema.partial().safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.message);
    try {
      const t = await this.updateTpl.execute({
        organizationId: user.organizationId, templateId, input: input.data,
      });
      return { data: this.toResponse(t) };
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('template_not_found'))
        throw new NotFoundException(err.message);
      throw err;
    }
  }

  private toResponse(t: import('@/domain/research/variable-template.entity').VariableTemplate) {
    return {
      id: t.id, organizationId: t.organizationId, createdBy: t.createdBy,
      name: t.name, description: t.description, type: t.type.value,
      unit: t.unit, options: t.options, range: t.range,
      createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
    };
  }
}
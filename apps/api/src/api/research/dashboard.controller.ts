// apps/api/src/api/research/dashboard.controller.ts
// Dashboard CRUD + widget endpoints (spec §4, design AD-2).
//   POST   /research/dashboards
//   GET    /research/dashboards
//   GET    /research/dashboards/:id
//   PATCH  /research/dashboards/:id
//   DELETE /research/dashboards/:id
//   POST   /research/dashboards/:id/widgets
//   DELETE /research/dashboards/:id/widgets/:widgetId
//   PATCH  /research/dashboards/:id/layout
//
// Widgets hold a live reference to a ResearchQuery (AD-2): refreshing a
// dashboard re-runs each widget's query with current data (spec §4 widget refresh).

import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { FeatureFlagGuard, RequireFeature } from '@/infrastructure/config/feature-flag.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type { JwtPayload, DashboardWidget, DashboardLayout, WidgetPosition } from '@medicore/contracts';
import { Action } from '@/domain/shared/rbac-permissions';
import { DashboardCommandHandler } from '@/application/research/commands/dashboard.handler';

@Controller('research')
@RequireFeature('RESEARCH_V2_DASHBOARDS')
@UseGuards(AuthGuard, RBACGuard, FeatureFlagGuard)
export class DashboardController {
  constructor(private readonly handler: DashboardCommandHandler) {}

  @Post('dashboards')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async create(
    @Body() body: {
      name: string;
      description?: string;
      widgets?: DashboardWidget[];
      layout?: DashboardLayout;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    if (!body?.name) throw new BadRequestException('name is required');
    const dashboard = await this.handler.create({
      organizationId: user.organizationId,
      createdBy: user.sub,
      name: body.name,
      description: body.description,
      widgets: body.widgets,
      layout: body.layout,
    });
    return { data: dashboard };
  }

  @Get('dashboards')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async list(
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.handler.findByOrg(
      user.organizationId,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
    return { data: result };
  }

  @Get('dashboards/:id')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async getOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const dashboard = await this.handler.findById(id, user.organizationId);
    if (!dashboard) throw new NotFoundException(`Dashboard not found: ${id}`);
    return { data: dashboard };
  }

  @Patch('dashboards/:id')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string | null; layout?: DashboardLayout },
    @CurrentUser() user: JwtPayload,
  ) {
    const dashboard = await this.handler.update({
      id,
      organizationId: user.organizationId,
      name: body.name,
      description: body.description,
      layout: body.layout,
    });
    return { data: dashboard };
  }

  @Delete('dashboards/:id')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async delete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.handler.softDelete(id, user.organizationId);
    return { data: { id, deleted: true } };
  }

  @Post('dashboards/:id/widgets')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async addWidget(
    @Param('id') id: string,
    @Body() body: DashboardWidget,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!body?.queryId) throw new BadRequestException('widget.queryId is required');
    const dashboard = await this.handler.addWidget({
      id,
      organizationId: user.organizationId,
      widget: body,
    });
    return { data: dashboard };
  }

  @Delete('dashboards/:id/widgets/:widgetId')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async removeWidget(
    @Param('id') id: string,
    @Param('widgetId') widgetId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const dashboard = await this.handler.removeWidget({
      id,
      organizationId: user.organizationId,
      widgetId,
    });
    return { data: dashboard };
  }

  @Patch('dashboards/:id/layout')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.READ_PATIENT)
  async updateLayout(
    @Param('id') id: string,
    @Body() body: { positions: Record<string, WidgetPosition> },
    @CurrentUser() user: JwtPayload,
  ) {
    const dashboard = await this.handler.updateLayout({
      id,
      organizationId: user.organizationId,
      positions: body.positions ?? {},
    });
    return { data: dashboard };
  }
}
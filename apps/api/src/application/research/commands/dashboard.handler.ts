// apps/api/src/application/research/commands/dashboard.handler.ts
// Use-case handler for Dashboard CRUD + widget add/remove (spec §4, design AD-2).
// Delegates aggregate invariants to the Dashboard entity (immutable mutations).

import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { DashboardLayout, DashboardWidget } from '@medicore/contracts';
import { Dashboard } from '@/domain/research/dashboard.entity';
import { DashboardWidgetVO } from '@/domain/research/value-objects/dashboard-widget.vo';
import type { IDashboardRepository } from '@/domain/research/ports/dashboard.repository.interface';

export interface CreateDashboardCommand {
  organizationId: string;
  createdBy: string;
  name: string;
  description?: string;
  widgets?: DashboardWidget[];
  layout?: DashboardLayout;
}

export interface UpdateDashboardCommand {
  id: string;
  organizationId: string;
  name?: string;
  description?: string | null;
  layout?: DashboardLayout;
}

export interface AddWidgetCommand {
  id: string;
  organizationId: string;
  widget: DashboardWidget;
}

export interface RemoveWidgetCommand {
  id: string;
  organizationId: string;
  widgetId: string;
}

export interface UpdateLayoutCommand {
  id: string;
  organizationId: string;
  positions: Record<string, { x: number; y: number; w: number; h: number }>;
}

@Injectable()
export class DashboardCommandHandler {
  constructor(
    @Inject('IDashboardRepository') private readonly repo: IDashboardRepository,
  ) {}

  async create(cmd: CreateDashboardCommand): Promise<Dashboard> {
    let dashboard = Dashboard.createPrivate({
      organizationId: cmd.organizationId,
      createdBy: cmd.createdBy,
      name: cmd.name,
      description: cmd.description,
      layout: cmd.layout,
    });
    for (const w of cmd.widgets ?? []) {
      dashboard = dashboard.addWidget(DashboardWidgetVO.create({ ...w, id: w.id ?? randomUUID() }));
    }
    return this.repo.save(dashboard);
  }

  async findById(id: string, organizationId: string): Promise<Dashboard | null> {
    return this.repo.findById(id, organizationId);
  }

  async findByOrg(organizationId: string, page: number, pageSize: number) {
    return this.repo.findByOrg({ organizationId, page, pageSize });
  }

  async update(cmd: UpdateDashboardCommand): Promise<Dashboard> {
    const existing = await this.repo.findById(cmd.id, cmd.organizationId);
    if (!existing) throw new Error(`Dashboard not found: ${cmd.id}`);
    const updated = existing.updateConfig({
      name: cmd.name,
      description: cmd.description,
      layout: cmd.layout,
    });
    return this.repo.update(updated);
  }

  async addWidget(cmd: AddWidgetCommand): Promise<Dashboard> {
    const widget = DashboardWidgetVO.create({ ...cmd.widget, id: cmd.widget.id ?? randomUUID() });
    return this.repo.addWidget(cmd.id, cmd.organizationId, widget);
  }

  async removeWidget(cmd: RemoveWidgetCommand): Promise<Dashboard> {
    return this.repo.removeWidget(cmd.id, cmd.organizationId, cmd.widgetId);
  }

  async updateLayout(cmd: UpdateLayoutCommand): Promise<Dashboard> {
    const existing = await this.repo.findById(cmd.id, cmd.organizationId);
    if (!existing) throw new Error(`Dashboard not found: ${cmd.id}`);
    const updated = existing.updateLayout(cmd.positions);
    return this.repo.update(updated);
  }

  async softDelete(id: string, organizationId: string): Promise<Dashboard> {
    return this.repo.softDelete(id, organizationId);
  }
}
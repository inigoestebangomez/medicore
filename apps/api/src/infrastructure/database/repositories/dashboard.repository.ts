// apps/api/src/infrastructure/database/repositories/dashboard.repository.ts
// Prisma implementation of IDashboardRepository (design AD-2).
// Tenant isolation: every read scoped by organizationId. Soft delete via deletedAt.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Dashboard } from '@/domain/research/dashboard.entity';
import { DashboardWidgetVO } from '@/domain/research/value-objects/dashboard-widget.vo';
import type {
  IDashboardRepository,
  ListDashboardsParams,
} from '@/domain/research/ports/dashboard.repository.interface';
import type { DashboardLayout, DashboardWidget as WidgetDTO } from '@medicore/contracts';

@Injectable()
export class PrismaDashboardRepository implements IDashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(dashboard: Dashboard): Promise<Dashboard> {
    const data = this.toPrismaCreate(dashboard) as any;
    const record = await this.prisma.dashboard.upsert({
      where: { id: dashboard.id },
      create: data,
      update: data,
    });
    return this.toEntity(record);
  }

  async findById(id: string, organizationId: string): Promise<Dashboard | null> {
    const record = await this.prisma.dashboard.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    return record ? this.toEntity(record) : null;
  }

  async findByOrg(params: ListDashboardsParams): Promise<{ items: Dashboard[]; total: number }> {
    const where = { organizationId: params.organizationId, deletedAt: null };
    const [records, total] = await Promise.all([
      this.prisma.dashboard.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.dashboard.count({ where }),
    ]);
    return { items: records.map((r) => this.toEntity(r)), total };
  }

  async update(dashboard: Dashboard): Promise<Dashboard> {
    const record = await this.prisma.dashboard.update({
      where: { id: dashboard.id },
      data: this.toPrismaUpdate(dashboard),
    });
    return this.toEntity(record);
  }

  async addWidget(
    id: string,
    organizationId: string,
    widget: DashboardWidgetVO,
  ): Promise<Dashboard> {
    const existing = await this.findById(id, organizationId);
    if (!existing) throw new Error(`Dashboard not found: ${id}`);
    const updated = existing.addWidget(widget);
    const record = await this.prisma.dashboard.update({
      where: { id },
      data: { widgets: updated.widgets.map((w) => w.toDTO()) as any, updatedAt: new Date() },
    });
    return this.toEntity(record);
  }

  async removeWidget(
    id: string,
    organizationId: string,
    widgetId: string,
  ): Promise<Dashboard> {
    const existing = await this.findById(id, organizationId);
    if (!existing) throw new Error(`Dashboard not found: ${id}`);
    const updated = existing.removeWidget(widgetId);
    const record = await this.prisma.dashboard.update({
      where: { id },
      data: { widgets: updated.widgets.map((w) => w.toDTO()) as any, updatedAt: new Date() },
    });
    return this.toEntity(record);
  }

  async softDelete(id: string, organizationId: string): Promise<Dashboard> {
    const record = await this.prisma.dashboard.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    void organizationId;
    return this.toEntity(record);
  }

  // ─────────────────────────────────────────────
  // Mapping
  // ─────────────────────────────────────────────

  private toPrismaCreate(d: Dashboard): Record<string, unknown> {
    return {
      id: d.id,
      organizationId: d.organizationId,
      createdBy: d.createdBy,
      name: d.name,
      description: d.description,
      widgets: d.widgets.map((w) => w.toDTO()) as unknown[],
      layout: d.layout as any,
    };
  }

  private toPrismaUpdate(d: Dashboard): Record<string, unknown> {
    return {
      name: d.name,
      description: d.description,
      widgets: d.widgets.map((w) => w.toDTO()) as any,
      layout: d.layout as any,
      updatedAt: new Date(),
    };
  }

  private parseWidgets(raw: unknown): DashboardWidgetVO[] {
    if (!Array.isArray(raw)) return [];
    return (raw as WidgetDTO[])
      .map((w) => {
        try {
          return DashboardWidgetVO.create(w);
        } catch {
          return null;
        }
      })
      .filter((w): w is DashboardWidgetVO => w !== null);
  }

  private toEntity(record: any): Dashboard {
    return new Dashboard({
      id: record.id,
      organizationId: record.organizationId,
      createdBy: record.createdBy,
      name: record.name,
      description: record.description,
      widgets: this.parseWidgets(record.widgets),
      layout: (record.layout as DashboardLayout) ?? { density: 'comfortable' },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }
}
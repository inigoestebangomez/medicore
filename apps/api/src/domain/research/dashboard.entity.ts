// apps/api/src/domain/research/dashboard.entity.ts
// Domain entity: Dashboard — a multi-widget research view (design AD-2).
// BR-RES-001: dashboards are private by default (createdBy only).
// Immutable: all mutations return a new Dashboard instance.

import { randomUUID } from 'crypto';
import type {
  DashboardLayout,
  WidgetChartType,
  WidgetPosition,
  WidgetDisplayConfig,
} from '@medicore/contracts';
import { DashboardWidgetVO } from './value-objects/dashboard-widget.vo';
import type { DashboardWidget } from '@medicore/contracts';

export interface DashboardProps {
  id: string;
  organizationId: string;
  createdBy: string;
  name: string;
  description?: string | null;
  widgets: DashboardWidgetVO[];
  layout: DashboardLayout;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export class Dashboard {
  readonly id: string;
  readonly organizationId: string;
  readonly createdBy: string;
  readonly name: string;
  readonly description: string | null;
  readonly widgets: DashboardWidgetVO[];
  readonly layout: DashboardLayout;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(props: DashboardProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.createdBy = props.createdBy;
    this.name = props.name;
    this.description = props.description ?? null;
    this.widgets = props.widgets ?? [];
    this.layout = props.layout ?? { density: 'comfortable' };
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    this.deletedAt = props.deletedAt ?? null;
  }

  // ─────────────────────────────────────────────
  // Factory — BR-RES-001 (private by default)
  // ─────────────────────────────────────────────

  static createPrivate(props: {
    id?: string;
    organizationId: string;
    createdBy: string;
    name: string;
    description?: string;
    layout?: DashboardLayout;
  }): Dashboard {
    return new Dashboard({
      id: props.id ?? randomUUID(),
      organizationId: props.organizationId,
      createdBy: props.createdBy,
      name: props.name,
      description: props.description ?? null,
      widgets: [],
      layout: props.layout ?? { density: 'comfortable' },
    });
  }

  // ─────────────────────────────────────────────
  // Widget mutations (immutable)
  // ─────────────────────────────────────────────

  /** Add a widget. Idempotent on widget.id (re-add same id is a no-op). */
  addWidget(widget: DashboardWidgetVO): Dashboard {
    if (this.widgets.some((w) => w.id === widget.id)) return this;
    return new Dashboard({
      ...this,
      widgets: [...this.widgets, widget],
      updatedAt: new Date(),
    });
  }

  removeWidget(widgetId: string): Dashboard {
    if (!this.widgets.some((w) => w.id === widgetId)) return this;
    return new Dashboard({
      ...this,
      widgets: this.widgets.filter((w) => w.id !== widgetId),
      updatedAt: new Date(),
    });
  }

  /** Bulk layout update (drag/drop) — positions keyed by widget id. */
  updateLayout(positions: Record<string, WidgetPosition>): Dashboard {
    const nextWidgets = this.widgets.map((w) => {
      const pos = positions[w.id];
      return pos ? w.moveTo(pos) : w;
    });
    return new Dashboard({
      ...this,
      widgets: nextWidgets,
      updatedAt: new Date(),
    });
  }

  updateConfig(input: {
    name?: string;
    description?: string | null;
    layout?: DashboardLayout;
  }): Dashboard {
    return new Dashboard({
      ...this,
      name: input.name ?? this.name,
      description: input.description !== undefined ? input.description : this.description,
      layout: input.layout ?? this.layout,
      updatedAt: new Date(),
    });
  }

  replaceWidget(widgetId: string, dto: DashboardWidget): Dashboard {
    const next = DashboardWidgetVO.create(dto);
    const widgets = this.widgets.map((w) => (w.id === widgetId ? next : w));
    if (!widgets.some((w) => w.id === widgetId)) widgets.push(next);
    return new Dashboard({ ...this, widgets, updatedAt: new Date() });
  }

  getWidget(widgetId: string): DashboardWidgetVO | undefined {
    return this.widgets.find((w) => w.id === widgetId);
  }

  get chartTypes(): WidgetChartType[] {
    return Array.from(new Set(this.widgets.map((w) => w.chartType)));
  }

  get displayConfigOf(): WidgetDisplayConfig[] {
    return this.widgets.map((w) => w.displayConfig);
  }

  // ─────────────────────────────────────────────
  // Visibility — BR-RES-001
  // ─────────────────────────────────────────────

  isOwnedBy(userId: string): boolean {
    return this.createdBy === userId;
  }

  // ─────────────────────────────────────────────
  // Soft delete
  // ─────────────────────────────────────────────

  delete(): Dashboard {
    return new Dashboard({ ...this, deletedAt: new Date() });
  }

  get isDeleted(): boolean {
    return this.deletedAt !== null;
  }
}
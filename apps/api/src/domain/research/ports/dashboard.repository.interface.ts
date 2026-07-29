// apps/api/src/domain/research/ports/dashboard.repository.interface.ts
// Repository port (interface) for Dashboard aggregates. Implementation lives in
// infrastructure (Prisma). The domain depends only on this interface so the
// handlers stay infrastructure-agnostic (Clean Architecture).

import type { Dashboard } from '../dashboard.entity';

export interface ListDashboardsParams {
  organizationId: string;
  page: number;
  pageSize: number;
}

export interface IDashboardRepository {
  save(dashboard: Dashboard): Promise<Dashboard>;
  findById(id: string, organizationId: string): Promise<Dashboard | null>;
  findByOrg(params: ListDashboardsParams): Promise<{ items: Dashboard[]; total: number }>;
  update(dashboard: Dashboard): Promise<Dashboard>;
  addWidget(
    id: string,
    organizationId: string,
    widget: Dashboard['widgets'][number],
  ): Promise<Dashboard>;
  removeWidget(
    id: string,
    organizationId: string,
    widgetId: string,
  ): Promise<Dashboard>;
  softDelete(id: string, organizationId: string): Promise<Dashboard>;
}
// apps/api/src/domain/research/research-query.entity.ts
// Domain entity: ResearchQuery — a saved ad-hoc query (spec §7-12).
// BR-RES-001: queries are private by default (createdBy only); explicit share
// action adds user IDs to sharedWith.

import type {
  Filter,
  FilterLogic,
  DataSource,
  VisualizationType,
} from '@medicore/contracts';

export interface ResearchQueryProps {
  id: string;
  organizationId: string;
  createdBy: string;
  name: string;
  description?: string | null;
  dataSource: DataSource;
  importBatchIds?: string[];
  filters: Filter[];
  filterLogic: FilterLogic;
  displayFields: string[];
  visualizations: VisualizationType[];
  sharedWith?: string[];
  lastRunAt?: Date | null;
  lastRunCount?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export class ResearchQuery {
  readonly id: string;
  readonly organizationId: string;
  readonly createdBy: string;
  readonly name: string;
  readonly description: string | null;
  readonly dataSource: DataSource;
  readonly importBatchIds: string[];
  readonly filters: Filter[];
  readonly filterLogic: FilterLogic;
  readonly displayFields: string[];
  readonly visualizations: VisualizationType[];
  readonly sharedWith: string[];
  readonly lastRunAt: Date | null;
  readonly lastRunCount: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(props: ResearchQueryProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.createdBy = props.createdBy;
    this.name = props.name;
    this.description = props.description ?? null;
    this.dataSource = props.dataSource ?? 'all_patients';
    this.importBatchIds = props.importBatchIds ?? [];
    this.filters = props.filters ?? [];
    this.filterLogic = props.filterLogic ?? 'AND';
    this.displayFields = props.displayFields ?? [];
    this.visualizations = props.visualizations ?? [];
    this.sharedWith = props.sharedWith ?? [];
    this.lastRunAt = props.lastRunAt ?? null;
    this.lastRunCount = props.lastRunCount ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    this.deletedAt = props.deletedAt ?? null;
  }

  // ─────────────────────────────────────────────
  // Factory — BR-RES-001 (private by default)
  // ─────────────────────────────────────────────

  static createPrivate(props: {
    id: string;
    organizationId: string;
    createdBy: string;
    name: string;
    description?: string;
    dataSource?: DataSource;
    importBatchIds?: string[];
    filters: Filter[];
    filterLogic: FilterLogic;
    displayFields: string[];
    visualizations: VisualizationType[];
  }): ResearchQuery {
    return new ResearchQuery({
      id: props.id,
      organizationId: props.organizationId,
      createdBy: props.createdBy,
      name: props.name,
      description: props.description ?? null,
      dataSource: props.dataSource ?? 'all_patients',
      importBatchIds: props.importBatchIds ?? [],
      filters: props.filters,
      filterLogic: props.filterLogic,
      displayFields: props.displayFields,
      visualizations: props.visualizations,
      sharedWith: [], // BR-RES-001: private by default
    });
  }

  // ─────────────────────────────────────────────
  // Visibility — BR-RES-001
  // ─────────────────────────────────────────────

  isVisibleTo(userId: string): boolean {
    return this.createdBy === userId || this.sharedWith.includes(userId);
  }

  /**
   * Targeted sharing — adds a user to sharedWith (explicit action for BR-RES-001).
   * Returns a new entity (immutable).
   */
  shareWith(userId: string): ResearchQuery {
    if (this.sharedWith.includes(userId)) return this;
    return new ResearchQuery({
      ...this,
      sharedWith: [...this.sharedWith, userId],
    });
  }

  unshareWith(userId: string): ResearchQuery {
    if (!this.sharedWith.includes(userId)) return this;
    return new ResearchQuery({
      ...this,
      sharedWith: this.sharedWith.filter((id) => id !== userId),
    });
  }

  // ─────────────────────────────────────────────
  // Filter mutations
  // ─────────────────────────────────────────────

  updateFilters(filters: Filter[], filterLogic: FilterLogic): ResearchQuery {
    return new ResearchQuery({
      ...this,
      filters,
      filterLogic,
      updatedAt: new Date(),
    });
  }

  updateConfig(input: {
    name?: string;
    description?: string | null;
    dataSource?: DataSource;
    importBatchIds?: string[];
    displayFields?: string[];
    visualizations?: VisualizationType[];
  }): ResearchQuery {
    return new ResearchQuery({
      ...this,
      name: input.name ?? this.name,
      description: input.description !== undefined ? input.description : this.description,
      dataSource: input.dataSource ?? this.dataSource,
      importBatchIds: input.importBatchIds ?? this.importBatchIds,
      displayFields: input.displayFields ?? this.displayFields,
      visualizations: input.visualizations ?? this.visualizations,
      updatedAt: new Date(),
    });
  }

  // ─────────────────────────────────────────────
  // Run tracking
  // ─────────────────────────────────────────────

  markRun(count: number): ResearchQuery {
    return new ResearchQuery({
      ...this,
      lastRunAt: new Date(),
      lastRunCount: count,
      updatedAt: new Date(),
    });
  }

  // ─────────────────────────────────────────────
  // Soft delete
  // ─────────────────────────────────────────────

  delete(): ResearchQuery {
    return new ResearchQuery({
      ...this,
      deletedAt: new Date(),
    });
  }

  get isDeleted(): boolean {
    return this.deletedAt !== null;
  }
}
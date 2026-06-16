// apps/api/src/domain/organization/organization.entity.ts
import { OrganizationType, PlanType } from './organization.types';

export class Organization {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly type: OrganizationType;
  readonly plan: PlanType;
  readonly settings: Record<string, unknown>;
  readonly logoUrl: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(props: {
    id: string;
    name: string;
    slug: string;
    type?: OrganizationType;
    plan?: PlanType;
    settings?: Record<string, unknown>;
    logoUrl?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
    deletedAt?: Date | null;
  }) {
    this.id = props.id;
    this.name = props.name;
    this.slug = props.slug;
    this.type = props.type ?? OrganizationType.SOLO_PRACTICE;
    this.plan = props.plan ?? PlanType.FREE;
    this.settings = props.settings ?? {};
    this.logoUrl = props.logoUrl ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    this.deletedAt = props.deletedAt ?? null;
  }
}
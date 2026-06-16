// apps/api/src/domain/organization/organization.repository.interface.ts
import { Organization } from './organization.entity';

export interface IOrganizationRepository {
  findById(id: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
  create(data: {
    name: string;
    slug: string;
    type?: string;
    logoUrl?: string | null;
  }): Promise<Organization>;
  update(id: string, data: { name?: string; settings?: Record<string, unknown>; logoUrl?: string | null }): Promise<Organization>;
  softDelete(id: string): Promise<Organization>;
}
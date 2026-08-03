// apps/api/src/domain/research/ports/variable-template.repository.interface.ts
// Port: IVariableTemplateRepository — persistence boundary for the org-level
// reusable variable library (REQ-FB-002). Multi-tenant.

import type { VariableTemplate } from '../variable-template.entity';
import type { Paginated } from './research-study.repository.interface';

export interface IVariableTemplateRepository {
  create(template: VariableTemplate): Promise<VariableTemplate>;
  findById(id: string, organizationId: string): Promise<VariableTemplate | null>;
  findByOrganization(organizationId: string, opts?: { page?: number; pageSize?: number }): Promise<Paginated<VariableTemplate>>;
  update(template: VariableTemplate): Promise<VariableTemplate>;
  delete(id: string, organizationId: string): Promise<void>;
  /** Create the immutable snapshot link when a study imports a template. */
  createLink(link: { templateId: string; studyId: string; studyVarId: string }): Promise<void>;
}

export type { Paginated };
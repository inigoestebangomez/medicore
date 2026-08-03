// apps/api/src/application/research/commands/variable-template.handlers.ts
// Handlers for the org-level reusable variable library (REQ-FB-002).
// Editing a template never mutates studies that imported a snapshot copy.

import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { VariableTemplate } from '@/domain/research/variable-template.entity';
import type { IVariableTemplateRepository } from '@/domain/research/ports/variable-template.repository.interface';
import type { Paginated } from '@/domain/research/ports/research-study.repository.interface';
import type { VariableTemplateInput } from '@medicore/contracts';

export interface CreateTemplateCommand {
  organizationId: string;
  createdBy: string;
  input: VariableTemplateInput;
}

@Injectable()
export class CreateVariableTemplateHandler {
  constructor(
    @Inject('IVariableTemplateRepository') private readonly repo: IVariableTemplateRepository,
  ) {}

  async execute(cmd: CreateTemplateCommand): Promise<VariableTemplate> {
    const template = VariableTemplate.create({
      id: randomUUID(),
      organizationId: cmd.organizationId,
      createdBy: cmd.createdBy,
      name: cmd.input.name,
      description: cmd.input.description,
      type: cmd.input.type,
      unit: cmd.input.unit ?? null,
      options: cmd.input.options ?? null,
      range: cmd.input.range ?? null,
    });
    return this.repo.create(template);
  }
}

export interface ListTemplatesCommand {
  organizationId: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ListVariableTemplatesHandler {
  constructor(
    @Inject('IVariableTemplateRepository') private readonly repo: IVariableTemplateRepository,
  ) {}

  async execute(cmd: ListTemplatesCommand): Promise<Paginated<VariableTemplate>> {
    return this.repo.findByOrganization(cmd.organizationId, {
      page: cmd.page,
      pageSize: cmd.pageSize,
    });
  }
}

export interface UpdateTemplateCommand {
  organizationId: string;
  templateId: string;
  input: Partial<VariableTemplateInput>;
}

@Injectable()
export class UpdateVariableTemplateHandler {
  constructor(
    @Inject('IVariableTemplateRepository') private readonly repo: IVariableTemplateRepository,
  ) {}

  async execute(cmd: UpdateTemplateCommand): Promise<VariableTemplate> {
    const t = await this.repo.findById(cmd.templateId, cmd.organizationId);
    if (!t) throw new Error(`template_not_found: ${cmd.templateId}`);
    return this.repo.update(
      t.update({
        name: cmd.input.name,
        description: cmd.input.description,
        unit: cmd.input.unit,
        options: cmd.input.options,
        range: cmd.input.range,
      }),
    );
  }
}
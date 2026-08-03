// apps/api/src/infrastructure/database/repositories/variable-template.repository.ts
// Prisma adapter for IVariableTemplateRepository (REQ-FB-002, V4).

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { VariableTemplate } from '@/domain/research/variable-template.entity';
import type { IVariableTemplateRepository } from '@/domain/research/ports/variable-template.repository.interface';
import type { Paginated } from '@/domain/research/ports/research-study.repository.interface';

@Injectable()
export class PrismaVariableTemplateRepository implements IVariableTemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(template: VariableTemplate): Promise<VariableTemplate> {
    const r = await this.prisma.variableTemplate.create({ data: this.toCreate(template) as any });
    return this.toEntity(r);
  }

  async findById(id: string, organizationId: string): Promise<VariableTemplate | null> {
    const r = await this.prisma.variableTemplate.findFirst({ where: { id, organizationId } });
    return r ? this.toEntity(r) : null;
  }

  async findByOrganization(organizationId: string, opts: { page?: number; pageSize?: number } = {}): Promise<Paginated<VariableTemplate>> {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 50;
    const where = { organizationId };
    const [records, total] = await Promise.all([
      this.prisma.variableTemplate.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.variableTemplate.count({ where }),
    ]);
    return { items: records.map((r) => this.toEntity(r)), total, page, pageSize };
  }

  async update(template: VariableTemplate): Promise<VariableTemplate> {
    const r = await this.prisma.variableTemplate.update({
      where: { id: template.id },
      data: {
        name: template.name,
        description: template.description,
        unit: template.unit,
        options: (template.options ?? undefined) as any,
        range: (template.range ?? undefined) as any,
        updatedAt: new Date(),
      } as any,
    });
    return this.toEntity(r);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    await this.prisma.variableTemplate.deleteMany({ where: { id, organizationId } });
  }

  async createLink(link: { templateId: string; studyId: string; studyVarId: string }): Promise<void> {
    await this.prisma.studyVariableLink.create({ data: link as any });
  }

  private toCreate(t: VariableTemplate): Record<string, unknown> {
    return {
      id: t.id,
      organizationId: t.organizationId,
      createdBy: t.createdBy,
      name: t.name,
      description: t.description,
      type: t.type.value,
      unit: t.unit,
      options: t.options ?? undefined,
      range: t.range ?? undefined,
    };
  }

  private toEntity(r: any): VariableTemplate {
    return new VariableTemplate({
      id: r.id,
      organizationId: r.organizationId,
      createdBy: r.createdBy,
      name: r.name,
      description: r.description,
      type: r.type,
      unit: r.unit,
      options: r.options ?? null,
      range: r.range ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }
}
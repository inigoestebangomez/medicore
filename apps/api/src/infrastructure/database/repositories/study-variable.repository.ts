// apps/api/src/infrastructure/database/repositories/study-variable.repository.ts
// Prisma adapter for IStudyVariableRepository (REQ-FB-001, V4).
// Tenant isolation: every read scoped by organizationId.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StudyVariable } from '@/domain/research/study-variable.entity';
import type { IStudyVariableRepository } from '@/domain/research/ports/study-variable.repository.interface';

@Injectable()
export class PrismaStudyVariableRepository implements IStudyVariableRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(variable: StudyVariable): Promise<StudyVariable> {
    const r = await this.prisma.studyVariable.create({ data: this.toCreate(variable) as any });
    return this.toEntity(r);
  }

  async createMany(variables: StudyVariable[]): Promise<StudyVariable[]> {
    await this.prisma.$transaction(
      variables.map((v) => this.prisma.studyVariable.create({ data: this.toCreate(v) as any })),
    );
    // Re-fetch in position order for the caller.
    const studyId = variables[0]?.studyId;
    const orgId = variables[0]?.organizationId;
    if (!studyId || !orgId) return variables;
    const records = await this.prisma.studyVariable.findMany({
      where: { studyId, organizationId: orgId },
      orderBy: { position: 'asc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findById(id: string, organizationId: string): Promise<StudyVariable | null> {
    const r = await this.prisma.studyVariable.findFirst({ where: { id, organizationId } });
    return r ? this.toEntity(r) : null;
  }

  async findByStudy(studyId: string, organizationId: string): Promise<StudyVariable[]> {
    const records = await this.prisma.studyVariable.findMany({
      where: { studyId, organizationId },
      orderBy: { position: 'asc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async update(variable: StudyVariable): Promise<StudyVariable> {
    const r = await this.prisma.studyVariable.update({
      where: { id: variable.id },
      data: this.toUpdate(variable),
    });
    return this.toEntity(r);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    await this.prisma.studyVariable.deleteMany({ where: { id, organizationId } });
  }

  async reorder(studyId: string, organizationId: string, orderedIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.studyVariable.updateMany({ where: { id, studyId, organizationId }, data: { position: index } }),
      ),
    );
  }

  private toCreate(v: StudyVariable): Record<string, unknown> {
    return {
      id: v.id,
      organizationId: v.organizationId,
      studyId: v.studyId,
      name: v.name,
      label: v.label,
      type: v.type.value,
      scope: v.scope.value,
      unit: v.unit,
      required: v.required,
      isCore: v.isCore,
      position: v.position,
      options: v.options ?? undefined,
      range: v.range ?? undefined,
      parentId: v.parentId,
    };
  }

  private toUpdate(v: StudyVariable): Record<string, unknown> {
    return {
      label: v.label,
      unit: v.unit,
      required: v.required,
      isCore: v.isCore,
      position: v.position,
      options: (v.options ?? undefined) as any,
      range: (v.range ?? undefined) as any,
      updatedAt: new Date(),
    };
  }

  private toEntity(r: any): StudyVariable {
    return new StudyVariable({
      id: r.id,
      organizationId: r.organizationId,
      studyId: r.studyId,
      name: r.name,
      label: r.label,
      type: r.type,
      scope: r.scope,
      unit: r.unit,
      required: r.required,
      isCore: r.isCore,
      position: r.position,
      options: r.options ?? null,
      range: r.range ?? null,
      parentId: r.parentId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }
}
// apps/api/src/infrastructure/database/repositories/organization.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Organization } from '@/domain/organization/organization.entity';
import { IOrganizationRepository } from '@/domain/organization/organization.repository.interface';
import { OrganizationType, PlanType } from '@/domain/organization/organization.types';

@Injectable()
export class PrismaOrganizationRepository implements IOrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Organization | null> {
    const record = await this.prisma.organization.findUnique({ where: { id } });
    if (!record) return null;
    return this.toEntity(record);
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const record = await this.prisma.organization.findUnique({ where: { slug } });
    if (!record) return null;
    return this.toEntity(record);
  }

  async create(data: {
    name: string;
    slug: string;
    type?: string;
    logoUrl?: string | null;
  }): Promise<Organization> {
    const record = await this.prisma.organization.create({
      data: {
        name: data.name,
        slug: data.slug,
        type: (data.type as OrganizationType) ?? OrganizationType.SOLO_PRACTICE,
        logoUrl: data.logoUrl ?? null,
      },
    });
    return this.toEntity(record);
  }

  async update(
    id: string,
    data: { name?: string; settings?: Record<string, unknown>; logoUrl?: string | null },
  ): Promise<Organization> {
    const record = await this.prisma.organization.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.settings && { settings: data.settings as any }),
        ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
      },
    });
    return this.toEntity(record);
  }

  async softDelete(id: string): Promise<Organization> {
    const record = await this.prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return this.toEntity(record);
  }

  private toEntity(record: {
    id: string;
    name: string;
    slug: string;
    type: string;
    plan: string;
    settings: any;
    logoUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): Organization {
    return new Organization({
      id: record.id,
      name: record.name,
      slug: record.slug,
      type: record.type as OrganizationType,
      plan: record.plan as PlanType,
      settings: record.settings as Record<string, unknown>,
      logoUrl: record.logoUrl,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }
}
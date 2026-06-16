// apps/api/src/infrastructure/database/repositories/organization-member.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OrganizationMember } from '@/domain/organization-member/organization-member.entity';
import { IOrganizationMemberRepository } from '@/domain/organization-member/organization-member.repository.interface';
import type { MemberRole } from '@medicore/contracts';

@Injectable()
export class PrismaOrganizationMemberRepository implements IOrganizationMemberRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<OrganizationMember[]> {
    const records = await this.prisma.organizationMember.findMany({
      where: { userId },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findByOrgId(organizationId: string): Promise<OrganizationMember[]> {
    const records = await this.prisma.organizationMember.findMany({
      where: { organizationId },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findByOrgAndUser(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMember | null> {
    const record = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!record) return null;
    return this.toEntity(record);
  }

  async create(data: {
    organizationId: string;
    userId: string;
    role: MemberRole;
    invitedBy?: string | null;
  }): Promise<OrganizationMember> {
    const record = await this.prisma.organizationMember.create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId,
        role: data.role,
        invitedBy: data.invitedBy ?? null,
      },
    });
    return this.toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.organizationMember.delete({ where: { id } });
  }

  async updateRole(id: string, role: MemberRole): Promise<OrganizationMember> {
    const record = await this.prisma.organizationMember.update({
      where: { id },
      data: { role },
    });
    return this.toEntity(record);
  }

  async countOwnersInOrg(organizationId: string): Promise<number> {
    return this.prisma.organizationMember.count({
      where: { organizationId, role: 'OWNER' },
    });
  }

  private toEntity(record: {
    id: string;
    organizationId: string;
    userId: string;
    role: string;
    invitedBy: string | null;
    joinedAt: Date;
    updatedAt: Date;
  }): OrganizationMember {
    return new OrganizationMember({
      id: record.id,
      organizationId: record.organizationId,
      userId: record.userId,
      role: record.role as MemberRole,
      invitedBy: record.invitedBy,
      joinedAt: record.joinedAt,
      updatedAt: record.updatedAt,
    });
  }
}
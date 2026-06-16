// apps/api/src/infrastructure/database/repositories/invitation.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Invitation } from '@/domain/invitation/invitation.entity';
import { IInvitationRepository } from '@/domain/invitation/invitation.repository.interface';
import type { MemberRole } from '@medicore/contracts';

@Injectable()
export class PrismaInvitationRepository implements IInvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    const record = await this.prisma.invitation.findUnique({ where: { tokenHash } });
    if (!record) return null;
    return this.toEntity(record);
  }

  async findByOrgId(organizationId: string): Promise<Invitation[]> {
    const records = await this.prisma.invitation.findMany({
      where: { organizationId },
    });
    return records.map((r) => this.toEntity(r));
  }

  async create(data: {
    email: string;
    tokenHash: string;
    role: MemberRole;
    organizationId: string;
    invitedBy: string;
    expiresAt: Date;
  }): Promise<Invitation> {
    const record = await this.prisma.invitation.create({
      data: {
        email: data.email,
        tokenHash: data.tokenHash,
        role: data.role,
        organizationId: data.organizationId,
        invitedBy: data.invitedBy,
        expiresAt: data.expiresAt,
      },
    });
    return this.toEntity(record);
  }

  async markAsUsed(id: string): Promise<Invitation> {
    const record = await this.prisma.invitation.update({
      where: { id },
      data: { usedAt: new Date() },
    });
    return this.toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.invitation.delete({ where: { id } });
  }

  async findByEmailAndOrg(email: string, organizationId: string): Promise<Invitation | null> {
    const record = await this.prisma.invitation.findFirst({
      where: { email, organizationId },
    });
    if (!record) return null;
    return this.toEntity(record);
  }

  private toEntity(record: {
    id: string;
    email: string;
    tokenHash: string;
    role: string;
    organizationId: string;
    invitedBy: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
  }): Invitation {
    return new Invitation({
      id: record.id,
      email: record.email,
      tokenHash: record.tokenHash,
      role: record.role as MemberRole,
      organizationId: record.organizationId,
      invitedBy: record.invitedBy,
      expiresAt: record.expiresAt,
      usedAt: record.usedAt,
      createdAt: record.createdAt,
    });
  }
}
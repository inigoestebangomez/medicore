// apps/api/src/infrastructure/database/repositories/pharma.repository.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type {
  IPharmaRepository,
  PharmaContact,
  PharmaInteraction,
  ListContactsParams,
  CreateContactInput,
  UpdateContactInput,
  CreateInteractionInput,
} from '@/domain/pharma/pharma.repository.interface';

@Injectable()
export class PrismaPharmaRepository implements IPharmaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listContacts(params: ListContactsParams): Promise<{ items: PharmaContact[]; total: number }> {
    const where: Record<string, unknown> = {
      organizationId: params.organizationId,
      deletedAt: null,
    };
    if (params.company) where.company = { contains: params.company, mode: 'insensitive' };

    const [records, total] = await Promise.all([
      this.prisma.pharmaContact.findMany({
        where,
        orderBy: { lastContactAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.pharmaContact.count({ where }),
    ]);
    return { items: records.map((r) => this.toContact(r)), total };
  }

  async createContact(data: CreateContactInput): Promise<PharmaContact> {
    const record = await this.prisma.pharmaContact.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        company: data.company,
        role: data.role ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        notes: data.notes ?? null,
        lastContactAt: data.lastContactAt ?? null,
        nextFollowUpAt: data.nextFollowUpAt ?? null,
      },
    });
    return this.toContact(record);
  }

  async updateContact(id: string, organizationId: string, data: UpdateContactInput): Promise<PharmaContact> {
    const existing = await this.prisma.pharmaContact.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Pharma contact not found');

    const record = await this.prisma.pharmaContact.update({
      where: { id },
      data: { ...data },
    });
    return this.toContact(record);
  }

  async deleteContact(id: string, organizationId: string): Promise<void> {
    const existing = await this.prisma.pharmaContact.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Pharma contact not found');

    await this.prisma.pharmaContact.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async listInteractions(organizationId: string, contactId: string): Promise<PharmaInteraction[]> {
    const records = await this.prisma.pharmaInteraction.findMany({
      where: { organizationId, contactId },
      orderBy: { date: 'desc' },
    });
    return records.map((r) => this.toInteraction(r));
  }

  async createInteraction(data: CreateInteractionInput): Promise<PharmaInteraction> {
    const contact = await this.prisma.pharmaContact.findFirst({
      where: { id: data.contactId, organizationId: data.organizationId, deletedAt: null },
      select: { id: true, nextFollowUpAt: true },
    });
    if (!contact) throw new NotFoundException('Pharma contact not found');

    const record = await this.prisma.pharmaInteraction.create({
      data: {
        organizationId: data.organizationId,
        contactId: data.contactId,
        type: (data.type ?? 'OTHER') as any,
        notes: data.notes ?? null,
        followUpNeeded: data.followUpNeeded ?? false,
        date: data.date ?? new Date(),
      },
    });

    // Keep contact's lastContactAt in sync
    await this.prisma.pharmaContact.update({
      where: { id: data.contactId },
      data: { lastContactAt: record.date },
    });

    return this.toInteraction(record);
  }

  private toContact(record: any): PharmaContact {
    return {
      id: record.id,
      organizationId: record.organizationId,
      name: record.name,
      company: record.company,
      role: record.role ?? null,
      email: record.email ?? null,
      phone: record.phone ?? null,
      notes: record.notes ?? null,
      lastContactAt: record.lastContactAt ?? null,
      nextFollowUpAt: record.nextFollowUpAt ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt ?? null,
    };
  }

  private toInteraction(record: any): PharmaInteraction {
    return {
      id: record.id,
      organizationId: record.organizationId,
      contactId: record.contactId,
      date: record.date,
      type: record.type,
      notes: record.notes ?? null,
      followUpNeeded: record.followUpNeeded,
      createdAt: record.createdAt,
    };
  }
}
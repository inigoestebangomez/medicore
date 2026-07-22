// apps/api/src/infrastructure/database/repositories/patient-collection.repository.ts
// Prisma implementation of IPatientCollectionRepository.
// BR-RES-003: lock() sets isLocked=true — members can no longer be added/removed.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  PatientCollection,
  CollectionMember,
} from '@/domain/research/patient-collection.entity';
import type {
  IPatientCollectionRepository,
  FindCollectionsParams,
} from '@/domain/research/patient-collection.repository.interface';
import { CollectionNotFoundError } from '@/domain/research/errors/collection-not-found.error';

@Injectable()
export class PrismaPatientCollectionRepository implements IPatientCollectionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(collection: PatientCollection): Promise<PatientCollection> {
    const data = {
      id: collection.id,
      organizationId: collection.organizationId,
      createdBy: collection.createdBy,
      name: collection.name,
      description: collection.description,
      queryId: collection.queryId,
      isLocked: collection.isLocked,
    };

    const record = await this.prisma.patientCollection.upsert({
      where: { id: collection.id },
      create: data,
      update: data,
    });

    // Save members if this is a new collection with members (fromQuery)
    if (collection.members.length > 0) {
      await this.syncMembers(collection.id, collection.members);
    }

    return this.toEntity(record, collection.members.length);
  }

  async findById(id: string, organizationId: string): Promise<PatientCollection | null> {
    const record = await this.prisma.patientCollection.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { members: true },
    });
    if (!record) return null;
    return this.toEntity(record, record.members.length);
  }

  async findByOrg(
    params: FindCollectionsParams,
  ): Promise<{ items: PatientCollection[]; total: number }> {
    const where = {
      organizationId: params.organizationId,
      deletedAt: null,
    };
    const [records, total] = await Promise.all([
      this.prisma.patientCollection.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: { _count: { select: { members: true } } },
      }),
      this.prisma.patientCollection.count({ where }),
    ]);
    return {
      items: records.map((r) =>
        this.toEntity(r, r._count?.members ?? 0),
      ),
      total,
    };
  }

  async addMembers(
    collectionId: string,
    organizationId: string,
    patientIds: string[],
    addedBy: string,
    notes?: string,
  ): Promise<PatientCollection> {
    const collection = await this.findById(collectionId, organizationId);
    if (!collection) throw new CollectionNotFoundError(collectionId);
    if (collection.isLocked) {
      const locked = collection.lock(); // triggers CollectionLockedError
      void locked;
    }

    // Insert members (ignore duplicates — Prisma composite PK enforces uniqueness)
    await this.prisma.$transaction(
      patientIds.map((patientId) =>
        this.prisma.patientCollectionMember.upsert({
          where: { collectionId_patientId: { collectionId, patientId } },
          create: { collectionId, patientId, addedBy, notes },
          update: { notes },
        }),
      ),
    );

    const record = await this.prisma.patientCollection.findFirst({
      where: { id: collectionId, organizationId },
      include: { _count: { select: { members: true } } },
    });
    if (!record) throw new CollectionNotFoundError(collectionId);
    return this.toEntity(record, record._count?.members ?? 0);
  }

  async removeMember(
    collectionId: string,
    organizationId: string,
    patientId: string,
  ): Promise<PatientCollection> {
    const collection = await this.findById(collectionId, organizationId);
    if (!collection) throw new CollectionNotFoundError(collectionId);
    if (collection.isLocked) {
      collection.lock(); // triggers CollectionLockedError
    }

    await this.prisma.patientCollectionMember.delete({
      where: { collectionId_patientId: { collectionId, patientId } },
    });

    const record = await this.prisma.patientCollection.findFirst({
      where: { id: collectionId, organizationId },
      include: { _count: { select: { members: true } } },
    });
    if (!record) throw new CollectionNotFoundError(collectionId);
    return this.toEntity(record, record._count?.members ?? 0);
  }

  async lock(id: string, organizationId: string): Promise<PatientCollection> {
    const record = await this.prisma.patientCollection.update({
      where: { id },
      data: { isLocked: true, updatedAt: new Date() },
      include: { _count: { select: { members: true } } },
    });
    void organizationId;
    return this.toEntity(record, record._count?.members ?? 0);
  }

  async softDelete(id: string, organizationId: string): Promise<PatientCollection> {
    const record = await this.prisma.patientCollection.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: { _count: { select: { members: true } } },
    });
    void organizationId;
    return this.toEntity(record, record._count?.members ?? 0);
  }

  async getMemberCount(collectionId: string, organizationId: string): Promise<number> {
    const record = await this.prisma.patientCollection.findFirst({
      where: { id: collectionId, organizationId },
      include: { _count: { select: { members: true } } },
    });
    return record?._count?.members ?? 0;
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  private async syncMembers(collectionId: string, members: CollectionMember[]): Promise<void> {
    for (const member of members) {
      await this.prisma.patientCollectionMember.upsert({
        where: {
          collectionId_patientId: {
            collectionId,
            patientId: member.patientId,
          },
        },
        create: {
          collectionId,
          patientId: member.patientId,
          addedBy: member.addedBy,
          notes: member.notes,
        },
        update: {},
      });
    }
  }

  private toEntity(record: any, memberCount: number): PatientCollection {
    const members: CollectionMember[] = record.members
      ? record.members.map((m: any) => new CollectionMember({
          collectionId: m.collectionId,
          patientId: m.patientId,
          addedBy: m.addedBy,
          addedAt: m.addedAt,
          notes: m.notes,
        }))
      : [];

    return new PatientCollection({
      id: record.id,
      organizationId: record.organizationId,
      createdBy: record.createdBy,
      name: record.name,
      description: record.description,
      queryId: record.queryId,
      isLocked: record.isLocked,
      members,
      patientCount: memberCount,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }
}
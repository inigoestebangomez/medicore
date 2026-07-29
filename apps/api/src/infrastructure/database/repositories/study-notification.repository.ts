// apps/api/src/infrastructure/database/repositories/study-notification.repository.ts
// Prisma adapter for IStudyNotificationRepository (M8).

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StudyNotification } from '@/domain/research/study-notification.entity';
import type { IStudyNotificationRepository } from '@/domain/research/ports/study-notification.repository.interface';

@Injectable()
export class PrismaStudyNotificationRepository implements IStudyNotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(n: StudyNotification): Promise<StudyNotification> {
    const record = await this.prisma.studyNotification.create({
      data: {
        id: n.id,
        studyId: n.studyId,
        organizationId: n.organizationId,
        userId: n.userId,
        newPatientCount: n.newPatientCount,
        readAt: n.readAt,
      } as any,
    });
    return this.toEntity(record);
  }

  async findByStudyAndUser(studyId: string, userId: string): Promise<StudyNotification[]> {
    const records = await this.prisma.studyNotification.findMany({
      where: { studyId, userId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findByStudy(studyId: string, organizationId: string): Promise<StudyNotification[]> {
    const records = await this.prisma.studyNotification.findMany({
      where: { studyId, organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async countUnread(studyId: string, userId: string): Promise<number> {
    return this.prisma.studyNotification.count({
      where: { studyId, userId, readAt: null },
    });
  }

  async markAsRead(id: string): Promise<StudyNotification | null> {
    const record = await this.prisma.studyNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return this.toEntity(record);
  }

  async markAllAsReadForStudy(studyId: string, userId: string): Promise<number> {
    const result = await this.prisma.studyNotification.updateMany({
      where: { studyId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  }

  private toEntity(record: any): StudyNotification {
    return new StudyNotification({
      id: record.id,
      studyId: record.studyId,
      organizationId: record.organizationId,
      userId: record.userId,
      newPatientCount: record.newPatientCount,
      readAt: record.readAt,
      createdAt: record.createdAt,
    });
  }
}
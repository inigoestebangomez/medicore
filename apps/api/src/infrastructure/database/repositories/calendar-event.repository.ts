// apps/api/src/infrastructure/database/repositories/calendar-event.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CalendarEvent, CalendarEventSource, CalendarEventStatus } from '@/domain/calendar/calendar-event.entity';
import type { ICalendarEventRepository, ListCalendarEventsParams } from '@/domain/calendar/calendar-event.repository.interface';
import type { Prisma, CalendarEvent as PrismaCalendarEvent } from '@prisma/client';

@Injectable()
export class PrismaCalendarEventRepository implements ICalendarEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(event: CalendarEvent): Promise<CalendarEvent> {
    const record = await this.prisma.calendarEvent.create({
      data: this.toPrisma(event),
    });
    return this.toEntity(record);
  }

  async update(event: CalendarEvent): Promise<CalendarEvent> {
    const record = await this.prisma.calendarEvent.update({
      where: { id: event.id },
      data: this.toPrisma(event),
    });
    return this.toEntity(record);
  }

  async delete(id: string, organizationId: string): Promise<CalendarEvent> {
    const record = await this.prisma.calendarEvent.update({
      where: { id, organizationId },
      data: { deletedAt: new Date(), status: 'CANCELLED', updatedAt: new Date() },
    });
    return this.toEntity(record);
  }

  async findById(id: string, organizationId: string): Promise<CalendarEvent | null> {
    const record = await this.prisma.calendarEvent.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!record) return null;
    return this.toEntity(record);
  }

  async listByUserAndDateRange(params: ListCalendarEventsParams): Promise<CalendarEvent[]> {
    const records = await this.prisma.calendarEvent.findMany({
      where: {
        userId: params.userId,
        organizationId: params.organizationId,
        deletedAt: null,
        startDateTime: { lte: params.to },
        endDateTime: { gte: params.from },
      },
      orderBy: { startDateTime: 'asc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async listByOrgAndDateRange(organizationId: string, from: Date, to: Date): Promise<CalendarEvent[]> {
    const records = await this.prisma.calendarEvent.findMany({
      where: {
        organizationId,
        deletedAt: null,
        startDateTime: { lte: to },
        endDateTime: { gte: from },
      },
      orderBy: { startDateTime: 'asc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  private toEntity(record: PrismaCalendarEvent): CalendarEvent {
    return new CalendarEvent({
      id: record.id,
      organizationId: record.organizationId,
      userId: record.userId,
      source: record.source as CalendarEventSource,
      sourceId: record.sourceId,
      externalCalendarId: record.externalCalendarId,
      title: record.title,
      description: record.description,
      startDateTime: record.startDateTime,
      endDateTime: record.endDateTime,
      status: record.status as CalendarEventStatus,
      isPublic: record.isPublic,
      contactName: record.contactName,
      contactEmail: record.contactEmail,
      metadata: record.metadata as Record<string, unknown> | null,
      lastSyncedAt: record.lastSyncedAt,
      deletedAt: record.deletedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  private toPrisma(event: CalendarEvent): Prisma.CalendarEventCreateInput | Prisma.CalendarEventUncheckedCreateInput {
    return {
      id: event.id,
      organizationId: event.organizationId,
      userId: event.userId,
      source: event.source,
      sourceId: event.sourceId,
      externalCalendarId: event.externalCalendarId,
      title: event.title,
      description: event.description,
      startDateTime: event.startDateTime,
      endDateTime: event.endDateTime,
      status: event.status,
      isPublic: event.isPublic,
      contactName: event.contactName,
      contactEmail: event.contactEmail,
      metadata: event.metadata as Prisma.InputJsonValue | undefined,
      lastSyncedAt: event.lastSyncedAt,
      deletedAt: event.deletedAt,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }
}

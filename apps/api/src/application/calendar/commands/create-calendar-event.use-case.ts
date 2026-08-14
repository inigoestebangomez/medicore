// apps/api/src/application/calendar/commands/create-calendar-event.use-case.ts
import type { ICalendarEventRepository } from '@/domain/calendar/calendar-event.repository.interface';
import { CalendarEvent, CalendarEventSource, CalendarEventStatus } from '@/domain/calendar/calendar-event.entity';

export interface CreateCalendarEventInput {
  organizationId: string;
  userId: string;
  title: string;
  description?: string | null;
  startDateTime: Date;
  endDateTime: Date;
  source?: CalendarEventSource;
  sourceId?: string | null;
  isPublic?: boolean;
  contactName?: string | null;
  contactEmail?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class CreateCalendarEventUseCase {
  constructor(private readonly repo: ICalendarEventRepository) {}

  async execute(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    const event = CalendarEvent.create({
      organizationId: input.organizationId,
      userId: input.userId,
      source: input.source ?? CalendarEventSource.MANUAL,
      sourceId: input.sourceId ?? null,
      externalCalendarId: null,
      title: input.title,
      description: input.description ?? null,
      startDateTime: input.startDateTime,
      endDateTime: input.endDateTime,
      status: CalendarEventStatus.CONFIRMED,
      isPublic: input.isPublic ?? false,
      contactName: input.contactName ?? null,
      contactEmail: input.contactEmail ?? null,
      metadata: input.metadata ?? null,
      lastSyncedAt: null,
      deletedAt: null,
    });
    return this.repo.create(event);
  }
}

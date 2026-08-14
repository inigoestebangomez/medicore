// apps/api/src/application/calendar/commands/update-calendar-event.use-case.ts
import type { ICalendarEventRepository } from '@/domain/calendar/calendar-event.repository.interface';
import { CalendarEvent, CalendarEventStatus } from '@/domain/calendar/calendar-event.entity';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

export interface UpdateCalendarEventInput {
  id: string;
  organizationId: string;
  userId: string;
  title?: string;
  description?: string | null;
  startDateTime?: Date;
  endDateTime?: Date;
  status?: CalendarEventStatus;
  isPublic?: boolean;
  contactName?: string | null;
  contactEmail?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class UpdateCalendarEventUseCase {
  constructor(private readonly repo: ICalendarEventRepository) {}

  async execute(input: UpdateCalendarEventInput): Promise<CalendarEvent> {
    const existing = await this.repo.findById(input.id, input.organizationId);
    if (!existing) throw new NotFoundException('Calendar event not found');
    if (existing.userId !== input.userId) throw new ForbiddenException('Cannot edit another user\'s event');

    const updated = new CalendarEvent({
      ...existing,
      title: input.title ?? existing.title,
      description: input.description !== undefined ? input.description : existing.description,
      startDateTime: input.startDateTime ?? existing.startDateTime,
      endDateTime: input.endDateTime ?? existing.endDateTime,
      status: input.status ?? existing.status,
      isPublic: input.isPublic ?? existing.isPublic,
      contactName: input.contactName !== undefined ? input.contactName : existing.contactName,
      contactEmail: input.contactEmail !== undefined ? input.contactEmail : existing.contactEmail,
      metadata: input.metadata !== undefined ? input.metadata : existing.metadata,
      updatedAt: new Date(),
    });

    return this.repo.update(updated);
  }
}

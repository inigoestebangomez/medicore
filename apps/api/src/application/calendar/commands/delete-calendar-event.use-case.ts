// apps/api/src/application/calendar/commands/delete-calendar-event.use-case.ts
import type { ICalendarEventRepository } from '@/domain/calendar/calendar-event.repository.interface';
import { CalendarEvent } from '@/domain/calendar/calendar-event.entity';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

export interface DeleteCalendarEventInput {
  id: string;
  organizationId: string;
  userId: string;
}

export class DeleteCalendarEventUseCase {
  constructor(private readonly repo: ICalendarEventRepository) {}

  async execute(input: DeleteCalendarEventInput): Promise<CalendarEvent> {
    const existing = await this.repo.findById(input.id, input.organizationId);
    if (!existing) throw new NotFoundException('Calendar event not found');
    if (existing.userId !== input.userId) throw new ForbiddenException('Cannot delete another user\'s event');

    return this.repo.delete(input.id, input.organizationId);
  }
}

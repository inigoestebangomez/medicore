// apps/api/src/application/calendar/queries/list-calendar-events.use-case.ts
import type { ICalendarEventRepository } from '@/domain/calendar/calendar-event.repository.interface';

export interface ListCalendarEventsInput {
  userId: string;
  organizationId: string;
  from: Date;
  to: Date;
}

export class ListCalendarEventsUseCase {
  constructor(private readonly repo: ICalendarEventRepository) {}

  async execute(input: ListCalendarEventsInput) {
    return this.repo.listByUserAndDateRange({
      userId: input.userId,
      organizationId: input.organizationId,
      from: input.from,
      to: input.to,
    });
  }
}

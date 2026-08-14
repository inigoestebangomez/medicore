// apps/api/src/domain/calendar/calendar-event.repository.interface.ts
import type { CalendarEvent } from './calendar-event.entity';

export interface ListCalendarEventsParams {
  userId: string;
  organizationId: string;
  from: Date;
  to: Date;
}

export interface ICalendarEventRepository {
  create(event: CalendarEvent): Promise<CalendarEvent>;
  update(event: CalendarEvent): Promise<CalendarEvent>;
  delete(id: string, organizationId: string): Promise<CalendarEvent>;
  findById(id: string, organizationId: string): Promise<CalendarEvent | null>;
  listByUserAndDateRange(params: ListCalendarEventsParams): Promise<CalendarEvent[]>;
  listByOrgAndDateRange(organizationId: string, from: Date, to: Date): Promise<CalendarEvent[]>;
}

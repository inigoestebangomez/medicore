// apps/api/src/application/calendar/commands/in-memory-calendar-event.repository.ts
import type { ICalendarEventRepository, ListCalendarEventsParams } from '@/domain/calendar/calendar-event.repository.interface';
import { CalendarEvent, CalendarEventStatus } from '@/domain/calendar/calendar-event.entity';

export class InMemoryCalendarEventRepository implements ICalendarEventRepository {
  private events: CalendarEvent[] = [];

  async create(event: CalendarEvent): Promise<CalendarEvent> {
    this.events.push(event);
    return event;
  }

  async update(event: CalendarEvent): Promise<CalendarEvent> {
    const idx = this.events.findIndex((e) => e.id === event.id);
    if (idx === -1) throw new Error('Event not found');
    this.events[idx] = event;
    return event;
  }

  async delete(id: string, _organizationId: string): Promise<CalendarEvent> {
    const idx = this.events.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error('Event not found');
    const event = new CalendarEvent({
      ...this.events[idx],
      deletedAt: new Date(),
      status: CalendarEventStatus.CANCELLED,
      updatedAt: new Date(),
    });
    this.events[idx] = event;
    return event;
  }

  async findById(id: string, _organizationId: string): Promise<CalendarEvent | null> {
    return this.events.find((e) => e.id === id && !e.deletedAt) ?? null;
  }

  async listByUserAndDateRange(params: ListCalendarEventsParams): Promise<CalendarEvent[]> {
    return this.events.filter(
      (e) =>
        e.userId === params.userId &&
        !e.deletedAt &&
        e.startDateTime <= params.to &&
        e.endDateTime >= params.from,
    );
  }

  async listByOrgAndDateRange(organizationId: string, from: Date, to: Date): Promise<CalendarEvent[]> {
    return this.events.filter(
      (e) =>
        e.organizationId === organizationId &&
        !e.deletedAt &&
        e.startDateTime <= to &&
        e.endDateTime >= from,
    );
  }
}

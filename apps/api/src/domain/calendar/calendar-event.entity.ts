// apps/api/src/domain/calendar/calendar-event.entity.ts

export enum CalendarEventSource {
  SURGERY = 'SURGERY',
  CONSULTATION = 'CONSULTATION',
  PHARMA_INTERACTION = 'PHARMA_INTERACTION',
  MANUAL = 'MANUAL',
  PUBLIC_BOOKING = 'PUBLIC_BOOKING',
  EXTERNAL_GOOGLE = 'EXTERNAL_GOOGLE',
  EXTERNAL_MICROSOFT = 'EXTERNAL_MICROSOFT',
  EXTERNAL_ICLOUD = 'EXTERNAL_ICLOUD',
}

export enum CalendarEventStatus {
  RESERVED = 'RESERVED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  TENTATIVE = 'TENTATIVE',
}

export interface CalendarEventProps {
  id: string;
  organizationId: string;
  userId: string;
  source: CalendarEventSource;
  sourceId: string | null;
  externalCalendarId: string | null;
  title: string;
  description: string | null;
  startDateTime: Date;
  endDateTime: Date;
  status: CalendarEventStatus;
  isPublic: boolean;
  contactName: string | null;
  contactEmail: string | null;
  metadata: Record<string, unknown> | null;
  lastSyncedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CalendarEvent {
  public readonly id: string;
  public readonly organizationId: string;
  public readonly userId: string;
  public readonly source: CalendarEventSource;
  public readonly sourceId: string | null;
  public readonly externalCalendarId: string | null;
  public readonly title: string;
  public readonly description: string | null;
  public readonly startDateTime: Date;
  public readonly endDateTime: Date;
  public readonly status: CalendarEventStatus;
  public readonly isPublic: boolean;
  public readonly contactName: string | null;
  public readonly contactEmail: string | null;
  public readonly metadata: Record<string, unknown> | null;
  public readonly lastSyncedAt: Date | null;
  public readonly deletedAt: Date | null;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: CalendarEventProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.source = props.source;
    this.sourceId = props.sourceId;
    this.externalCalendarId = props.externalCalendarId;
    this.title = props.title;
    this.description = props.description;
    this.startDateTime = props.startDateTime;
    this.endDateTime = props.endDateTime;
    this.status = props.status;
    this.isPublic = props.isPublic;
    this.contactName = props.contactName;
    this.contactEmail = props.contactEmail;
    this.metadata = props.metadata;
    this.lastSyncedAt = props.lastSyncedAt;
    this.deletedAt = props.deletedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  isCancelled(): boolean {
    return this.status === CalendarEventStatus.CANCELLED;
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  static create(props: Omit<CalendarEventProps, 'id' | 'createdAt' | 'updatedAt'>): CalendarEvent {
    const now = new Date();
    return new CalendarEvent({
      ...props,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    });
  }
}

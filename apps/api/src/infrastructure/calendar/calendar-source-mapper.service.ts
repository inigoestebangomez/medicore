// apps/api/src/infrastructure/calendar/calendar-source-mapper.service.ts
import { Injectable, Inject } from '@nestjs/common';
import type { ICalendarEventRepository } from '@/domain/calendar/calendar-event.repository.interface';
import { CalendarEventSource, CalendarEventStatus } from '@/domain/calendar/calendar-event.entity';
import { PrismaService } from '@/infrastructure/database/prisma.service';

export interface CalendarEventView {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  startDateTime: Date;
  endDateTime: Date;
  source: CalendarEventSource;
  sourceId: string | null;
  status: CalendarEventStatus;
  patientName: string | null;
  link: string | null;
}

export interface ListMergedEventsParams {
  userId: string;
  organizationId: string;
  from: Date;
  to: Date;
}

@Injectable()
export class CalendarSourceMapperService {
  constructor(
    @Inject('ICalendarEventRepository') private readonly calendarRepo: ICalendarEventRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listMergedEvents(params: ListMergedEventsParams): Promise<CalendarEventView[]> {
    const [persisted, surgeries, consultations, pharmaInteractions] = await Promise.all([
      this.calendarRepo.listByUserAndDateRange(params),
      this.fetchSurgeries(params),
      this.fetchConsultations(params),
      this.fetchPharmaInteractions(params),
    ]);

    const views: CalendarEventView[] = [];

    // Persisted calendar events (MANUAL, PUBLIC_BOOKING, EXTERNAL_*)
    for (const event of persisted) {
      views.push({
        id: event.id,
        userId: event.userId,
        title: event.title,
        description: event.description,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        source: event.source,
        sourceId: event.sourceId,
        status: event.status,
        patientName: event.contactName,
        link: event.source === CalendarEventSource.MANUAL ? null : null,
      });
    }

    // Virtual: Surgeries
    for (const s of surgeries) {
      const patientName = (s as any).patient?.firstName && (s as any).patient?.lastName
        ? `${(s as any).patient.firstName} ${(s as any).patient.lastName}`
        : 'Paciente';
      views.push({
        id: `virtual-surgery-${s.id}`,
        userId: params.userId,
        title: `${patientName} — ${s.procedureType}`,
        description: null,
        startDateTime: new Date(s.date),
        endDateTime: new Date(s.date),
        source: CalendarEventSource.SURGERY,
        sourceId: s.id,
        status: CalendarEventStatus.CONFIRMED,
        patientName,
        link: `/patients/${s.patientId}/surgeries/${s.id}`,
      });
    }

    // Virtual: Consultations
    for (const c of consultations) {
      const patientName = (c as any).patient?.firstName && (c as any).patient?.lastName
        ? `${(c as any).patient.firstName} ${(c as any).patient.lastName}`
        : 'Paciente';
      views.push({
        id: `virtual-consultation-${c.id}`,
        userId: params.userId,
        title: `${patientName} — Consulta`,
        description: (c as any).chiefComplaint ?? null,
        startDateTime: new Date(c.date),
        endDateTime: new Date(c.date),
        source: CalendarEventSource.CONSULTATION,
        sourceId: c.id,
        status: CalendarEventStatus.CONFIRMED,
        patientName,
        link: `/patients/${c.patientId}/consultations/${c.id}`,
      });
    }

    // Virtual: Pharma Interactions
    for (const pi of pharmaInteractions) {
      views.push({
        id: `virtual-pharma-${pi.id}`,
        userId: params.userId,
        title: (pi as any).notes?.substring(0, 60) ?? 'Seguimiento farma',
        description: (pi as any).notes ?? null,
        startDateTime: new Date(pi.date),
        endDateTime: new Date(pi.date),
        source: CalendarEventSource.PHARMA_INTERACTION,
        sourceId: pi.id,
        status: CalendarEventStatus.CONFIRMED,
        patientName: null,
        link: '/pharma',
      });
    }

    return views.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
  }

  private async fetchSurgeries(params: ListMergedEventsParams) {
    return this.prisma.surgery.findMany({
      where: {
        organizationId: params.organizationId,
        physicianId: params.userId,
        deletedAt: null,
        date: { gte: params.from, lte: params.to },
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { date: 'asc' },
    });
  }

  private async fetchConsultations(params: ListMergedEventsParams) {
    return this.prisma.consultation.findMany({
      where: {
        organizationId: params.organizationId,
        physicianId: params.userId,
        deletedAt: null,
        date: { gte: params.from, lte: params.to },
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { date: 'asc' },
    });
  }

  private async fetchPharmaInteractions(params: ListMergedEventsParams) {
    const fromDate = params.from;
    const toDate = params.to;

    return this.prisma.pharmaInteraction.findMany({
      where: {
        organizationId: params.organizationId,
        followUpNeeded: true,
        date: { gte: fromDate, lte: toDate },
      },
      orderBy: { date: 'asc' },
    });
  }
}

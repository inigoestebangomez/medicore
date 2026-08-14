// apps/api/src/api/calendar/public-booking.controller.ts
import { Controller, Get, Post, Param, Body, Query, Inject, HttpCode, HttpStatus, NotFoundException, ConflictException } from '@nestjs/common';
import { ICalendarEventRepository } from '@/domain/calendar/calendar-event.repository.interface';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CalendarEvent, CalendarEventSource, CalendarEventStatus } from '@/domain/calendar/calendar-event.entity';
import { ZodValidationPipe } from '@/api/shared/pipes/zod-validation.pipe';
import { z } from 'zod';

// ─────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────

const PublicBookingQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const BookSlotSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  reason: z.string().max(1000).optional(),
  slotDate: z.string(),
  slotStart: z.string(),
  slotEnd: z.string(),
});

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

interface AvailableSlot {
  date: string;
  startTime: string;
  endTime: string;
}

interface DoctorSchedule {
  id: string;
  userId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDuration: number;
  isActive: boolean;
}

function getDateRange(from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date();
  const start = from ? new Date(from) : now;
  const end = to ? new Date(to) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  return { from: start, to: end };
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ─────────────────────────────────────────────
// Controller
// ─────────────────────────────────────────────

@Controller('calendar/:userId/public')
export class PublicBookingController {
  constructor(
    @Inject('ICalendarEventRepository') private readonly calendarRepo: ICalendarEventRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /** GET available slots for a doctor in a date range */
  @Get('slots')
  async getSlots(
    @Param('userId') userId: string,
    @Query(new ZodValidationPipe(PublicBookingQuerySchema)) query: any,
  ) {
    const { from, to } = getDateRange(query.from, query.to);

    // Get doctor's schedule templates
    const schedules = await this.prisma.doctorSchedule.findMany({
      where: { userId, isActive: true },
    }) as DoctorSchedule[];

    if (schedules.length === 0) {
      return { slots: [], message: 'No hay horarios configurados' };
    }

    // Get existing bookings in range to exclude
    const busySlots = await this.calendarRepo.listByUserAndDateRange({
      userId,
      organizationId: '', // public endpoint, org check not applicable
      from,
      to,
    });

    // Also get surgeries assigned to this doctor
    const surgeries = await this.prisma.surgery.findMany({
      where: { physicianId: userId, deletedAt: null, date: { gte: from, lte: to } },
    });

    // Build busy set: date -> set of busy time slots
    const busyByDate = new Map<string, Set<string>>();
    for (const event of busySlots) {
      const dateKey = toISODate(event.startDateTime);
      if (!busyByDate.has(dateKey)) busyByDate.set(dateKey, new Set());
      busyByDate.get(dateKey)!.add(`${event.startDateTime.toISOString()}-${event.endDateTime.toISOString()}`);
    }
    // Mark surgery dates as fully busy
    for (const s of surgeries) {
      const dateKey = toISODate(new Date(s.date));
      if (!busyByDate.has(dateKey)) busyByDate.set(dateKey, new Set());
    }

    // Generate available slots
    const available: AvailableSlot[] = [];
    const dayMs = 24 * 60 * 60 * 1000;

    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + dayMs)) {
      const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1; // 0=Sun → 6, 1=Mon → 0
      const dateKey = toISODate(d);
      const busy = busyByDate.get(dateKey);

      // If surgeries on this day, skip entirely
      if (busy && busy.size > 0 && surgeries.some(s => toISODate(new Date(s.date)) === dateKey)) {
        continue;
      }

      for (const schedule of schedules) {
        if (schedule.dayOfWeek !== dayOfWeek) continue;
        if (!schedule.startTime || !schedule.endTime) continue;

        const duration = schedule.slotDuration || 30; // default 30 min
        const [sh, sm] = schedule.startTime.split(':').map(Number);
        const [eh, em] = schedule.endTime.split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;

        for (let t = startMin; t + duration <= endMin; t += duration) {
          const h = Math.floor(t / 60);
          const m = t % 60;
          const startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          const hEnd = Math.floor((t + duration) / 60);
          const mEnd = (t + duration) % 60;
          const endTime = `${String(hEnd).padStart(2, '0')}:${String(mEnd).padStart(2, '0')}`;

          // Check if this time slot overlaps with any busy slot
          const slotStart = new Date(`${dateKey}T${startTime}:00`);
          const slotEnd = new Date(`${dateKey}T${endTime}:00`);
          const isBusy = busy && [...busy].some((range) => {
            const [bStart, bEnd] = range.split('-');
            return slotStart < new Date(bEnd) && slotEnd > new Date(bStart);
          });

          if (!isBusy) {
            available.push({ date: dateKey, startTime, endTime });
          }
        }
      }
    }

    return { slots: available };
  }

  /** POST anonymous booking */
  @Post('book')
  @HttpCode(HttpStatus.CREATED)
  async bookSlot(
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(BookSlotSchema)) body: any,
  ) {
    // Get the doctor's organization
    const orgMember = await this.prisma.organizationMember.findFirst({
      where: { userId },
      include: { organization: true },
    });
    if (!orgMember) throw new NotFoundException('Doctor not found');
    const org = orgMember.organization;

    const startDateTime = new Date(`${body.slotDate}T${body.slotStart}:00`);
    const endDateTime = new Date(`${body.slotDate}T${body.slotEnd}:00`);

    // Check for double-booking
    const conflicts = await this.calendarRepo.listByUserAndDateRange({
      userId,
      organizationId: org.id,
      from: new Date(startDateTime.getTime() - 60000),
      to: new Date(endDateTime.getTime() + 60000),
    });

    const hasConflict = conflicts.some(
      (e) => e.startDateTime < endDateTime && e.endDateTime > startDateTime,
    );

    if (hasConflict) {
      throw new ConflictException('Este horario ya no está disponible');
    }

    // Create booking as CalendarEvent
    const event = CalendarEvent.create({
      organizationId: org.id,
      userId,
      source: CalendarEventSource.PUBLIC_BOOKING,
      sourceId: null,
      externalCalendarId: null,
      title: `Reserva: ${body.name}`,
      description: body.reason ?? null,
      startDateTime,
      endDateTime,
      status: CalendarEventStatus.RESERVED,
      isPublic: false,
      contactName: body.name,
      contactEmail: body.email,
      metadata: null,
      lastSyncedAt: null,
      deletedAt: null,
    });

    const saved = await this.calendarRepo.create(event);

    return {
      id: saved.id,
      message: 'Reserva creada. El médico la confirmará.',
    };
  }
}

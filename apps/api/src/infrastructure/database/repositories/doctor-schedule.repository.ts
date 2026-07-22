// apps/api/src/infrastructure/database/repositories/doctor-schedule.repository.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type {
  IDoctorScheduleRepository,
  DoctorSchedule,
  UpsertScheduleInput,
} from '@/domain/schedule/schedule.repository.interface';

@Injectable()
export class PrismaDoctorScheduleRepository implements IDoctorScheduleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByUser(organizationId: string, userId: string): Promise<DoctorSchedule[]> {
    const records = await this.prisma.doctorSchedule.findMany({
      where: { organizationId, userId, isActive: true },
      orderBy: { dayOfWeek: 'asc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async upsert(input: UpsertScheduleInput): Promise<DoctorSchedule> {
    const record = await this.prisma.doctorSchedule.upsert({
      where: {
        organizationId_userId_dayOfWeek: {
          organizationId: input.organizationId,
          userId: input.userId,
          dayOfWeek: input.dayOfWeek,
        },
      },
      create: {
        organizationId: input.organizationId,
        userId: input.userId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        slotDuration: input.slotDuration ?? 30,
        isActive: true,
      },
      update: {
        startTime: input.startTime,
        endTime: input.endTime,
        slotDuration: input.slotDuration ?? 30,
        isActive: true,
      },
    });
    return this.toEntity(record);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const existing = await this.prisma.doctorSchedule.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Schedule entry not found');
    }
    await this.prisma.doctorSchedule.delete({ where: { id } });
  }

  private toEntity(record: any): DoctorSchedule {
    return {
      id: record.id,
      organizationId: record.organizationId,
      userId: record.userId,
      dayOfWeek: record.dayOfWeek,
      startTime: record.startTime,
      endTime: record.endTime,
      slotDuration: record.slotDuration,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
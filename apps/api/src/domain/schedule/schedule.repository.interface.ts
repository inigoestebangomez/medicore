// apps/api/src/domain/schedule/schedule.repository.interface.ts
export interface DoctorSchedule {
  id: string;
  organizationId: string;
  userId: string;
  dayOfWeek: number; // 0=Sun..6=Sat
  startTime: string; // "09:00"
  endTime: string; // "17:00"
  slotDuration: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertScheduleInput {
  organizationId: string;
  userId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDuration?: number;
}

export interface IDoctorScheduleRepository {
  listByUser(organizationId: string, userId: string): Promise<DoctorSchedule[]>;
  upsert(input: UpsertScheduleInput): Promise<DoctorSchedule>;
  delete(id: string, organizationId: string): Promise<void>;
}
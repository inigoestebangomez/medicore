// apps/api/src/api/schedule/dto/schedule.dto.ts
import { z } from 'zod';

export const UpsertScheduleSchema = z.object({
  userId: z.string().min(1),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotDuration: z.number().int().min(5).max(240).optional(),
});
export type UpsertScheduleInput = z.infer<typeof UpsertScheduleSchema>;

export const ListScheduleQuerySchema = z.object({
  userId: z.string().optional(),
});
export type ListScheduleQuery = z.infer<typeof ListScheduleQuerySchema>;
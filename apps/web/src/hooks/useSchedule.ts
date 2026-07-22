// apps/web/src/hooks/useSchedule.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-fetch';

const API_BASE = '/v1/schedule';

export interface DoctorSchedule {
  id: string;
  organizationId: string;
  userId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDuration: number;
  isActive: boolean;
}

interface ListResponse {
  items: DoctorSchedule[];
  userId: string;
}

export interface UpsertScheduleInput {
  userId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDuration?: number;
}

const scheduleKeys = {
  all: ['schedule'] as const,
  list: (userId?: string) => [...scheduleKeys.all, 'list', userId ?? 'me'] as const,
};

export function useSchedule(userId?: string) {
  const queryParams = new URLSearchParams();
  if (userId) queryParams.set('userId', userId);
  return useQuery<ListResponse>({
    queryKey: scheduleKeys.list(userId),
    queryFn: async () => {
      const res = await apiFetch<{ data: ListResponse } | ListResponse>(
        `${API_BASE}?${queryParams.toString()}`,
      );
      return 'data' in res ? (res as { data: ListResponse }).data : (res as ListResponse);
    },
  });
}

export function useUpsertSchedule() {
  const queryClient = useQueryClient();
  return useMutation<DoctorSchedule, Error, UpsertScheduleInput>({
    mutationFn: async (input) => {
      const res = await apiFetch<{ data: DoctorSchedule } | DoctorSchedule>(API_BASE, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return 'data' in res ? (res as { data: DoctorSchedule }).data : (res as DoctorSchedule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  return useMutation<{ id: string }, Error, string>({
    mutationFn: async (id) => {
      const res = await apiFetch<{ data: { id: string } } | { id: string }>(
        `${API_BASE}/${id}`,
        { method: 'DELETE' },
      );
      return 'data' in res ? (res as { data: { id: string } }).data : (res as { id: string });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
}
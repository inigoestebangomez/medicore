// apps/web/src/hooks/useCalendarEvents.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-fetch';
import type { CalendarEventView } from '@medicore/contracts';

const API_BASE = '/v1/calendar/events';

const calendarKeys = {
  all: ['calendar'] as const,
  range: (from: string, to: string) => [...calendarKeys.all, 'range', from, to] as const,
};

export function useCalendarEvents(from: string, to: string) {
  return useQuery<CalendarEventView[]>({
    queryKey: calendarKeys.range(from, to),
    queryFn: async () => {
      const res = await apiFetch<CalendarEventView[]>(
        `${API_BASE}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      return Array.isArray(res) ? res : (res as any).data ?? [];
    },
    enabled: !!from && !!to,
  });
}

interface CreateCalendarEventInput {
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  isPublic?: boolean;
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, CreateCalendarEventInput>({
    mutationFn: async (input) => {
      return apiFetch(API_BASE, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
}

interface UpdateCalendarEventInput {
  id: string;
  title?: string;
  description?: string | null;
  startDateTime?: string;
  endDateTime?: string;
  status?: string;
  isPublic?: boolean;
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, UpdateCalendarEventInput>({
    mutationFn: async ({ id, ...input }) => {
      return apiFetch(`${API_BASE}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: async (id) => {
      return apiFetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
}

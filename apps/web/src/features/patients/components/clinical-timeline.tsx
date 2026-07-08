'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { ConsultationListItem, SurgeryResponse } from '@medicore/contracts';
import { apiFetch } from '@/lib/api-fetch';

const API_BASE = '/v1/patients';

interface TimelineEvent {
  id: string;
  type: 'consultation' | 'surgery' | 'imaging';
  date: string;
  label: string;
  description: string;
  href: string;
}

interface ClinicalTimelineProps {
  patientId: string;
}

interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ImagingStudyRef {
  id: string;
  type: string;
  date: string;
  description: string | null;
}

const EVENT_ICONS: Record<TimelineEvent['type'], React.ReactNode> = {
  consultation: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  surgery: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M16 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-4" />
      <path d="M12 6v2" />
      <path d="M12 16v2" />
    </svg>
  ),
  imaging: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <circle cx="12" cy="12" r="1" />
      <path d="M5 12s2-6 7-6 7 6 7 6-2 6-7 6-7-6-7-6" />
    </svg>
  ),
};

const EVENT_LABELS: Record<TimelineEvent['type'], string> = {
  consultation: 'Consultation',
  surgery: 'Surgery',
  imaging: 'Imaging',
};

const EVENT_COLORS: Record<TimelineEvent['type'], string> = {
  consultation: 'bg-blue-100 text-blue-700',
  surgery: 'bg-green-100 text-green-700',
  imaging: 'bg-purple-100 text-purple-700',
};

const DOT_COLORS: Record<TimelineEvent['type'], string> = {
  consultation: 'bg-blue-500',
  surgery: 'bg-green-500',
  imaging: 'bg-purple-500',
};

const PAGE_SIZE = 20;

export function ClinicalTimeline({ patientId }: ClinicalTimelineProps) {
  const consultationsQuery = useQuery<ListResponse<ConsultationListItem>>({
    queryKey: ['consultations', patientId, 'list'],
    queryFn: async () => {
      const res = await apiFetch<{ data: ListResponse<ConsultationListItem> } | ListResponse<ConsultationListItem>>(
        `${API_BASE}/${patientId}/consultations?page=1&pageSize=${PAGE_SIZE}&sortBy=date&sortOrder=desc`,
      );
      return 'data' in res ? res.data : res;
    },
    enabled: !!patientId,
  });

  const surgeriesQuery = useQuery<ListResponse<SurgeryResponse>>({
    queryKey: ['surgeries', patientId, 'list'],
    queryFn: async () => {
      const res = await apiFetch<{ data: ListResponse<SurgeryResponse> } | ListResponse<SurgeryResponse>>(
        `${API_BASE}/${patientId}/surgeries?page=1&pageSize=${PAGE_SIZE}&sortBy=date&sortOrder=desc`,
      );
      return 'data' in res ? res.data : res;
    },
    enabled: !!patientId,
  });

  const imagingQuery = useQuery<ListResponse<ImagingStudyRef>>({
    queryKey: ['imaging', patientId, 'list'],
    queryFn: async () => {
      const res = await apiFetch<{ data: ListResponse<ImagingStudyRef> } | ListResponse<ImagingStudyRef>>(
        `${API_BASE}/${patientId}/imaging?page=1&pageSize=${PAGE_SIZE}&sortBy=date&sortOrder=desc`,
      );
      return 'data' in res ? res.data : res;
    },
    enabled: !!patientId,
  });

  const isLoading = consultationsQuery.isLoading || surgeriesQuery.isLoading || imagingQuery.isLoading;
  const isError = consultationsQuery.isError || surgeriesQuery.isError || imagingQuery.isError;
  const error =
    consultationsQuery.error?.message ??
    surgeriesQuery.error?.message ??
    imagingQuery.error?.message ??
    'Failed to load timeline';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  const events: TimelineEvent[] = [
    ...(consultationsQuery.data?.items ?? []).map(
      (item): TimelineEvent => ({
        id: item.id,
        type: 'consultation',
        date: item.date,
        label: item.type.replace(/_/g, ' '),
        description: item.chiefComplaint,
        href: `/patients/${patientId}/consultations/${item.id}`,
      }),
    ),
    ...(surgeriesQuery.data?.items ?? []).map(
      (item): TimelineEvent => ({
        id: item.id,
        type: 'surgery',
        date: item.date,
        label: item.status,
        description: item.procedureType,
        href: `/patients/${patientId}/surgeries/${item.id}`,
      }),
    ),
    ...(imagingQuery.data?.items ?? []).map(
      (item): TimelineEvent => ({
        id: item.id,
        type: 'imaging',
        date: item.date,
        label: item.type.replace(/_/g, ' '),
        description: item.description ?? 'No description',
        href: `/patients/${patientId}/imaging/${item.id}`,
      }),
    ),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (events.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        No clinical events recorded yet
      </div>
    );
  }

  return (
    <div className="relative space-y-0 pl-8">
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200" />

      {events.map((event) => {
        const IconNode = EVENT_ICONS[event.type];
        const dateFormatted = new Date(event.date).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });

        return (
          <Link
            key={`${event.type}-${event.id}`}
            href={event.href}
            className="relative block pb-5 group"
          >
            <span
              className={`absolute left-[-20px] top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white ${DOT_COLORS[event.type]}`}
            >
              {IconNode}
            </span>

            <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm transition-shadow group-hover:shadow-md">
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_COLORS[event.type]}`}
                >
                  {EVENT_LABELS[event.type]}
                </span>
                <span className="text-xs text-gray-400">{dateFormatted}</span>
              </div>
              {event.label && (
                <p className="mt-1 text-xs text-gray-500">{event.label}</p>
              )}
              <p className="mt-1 text-sm font-medium text-gray-900 line-clamp-1">
                {event.description}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

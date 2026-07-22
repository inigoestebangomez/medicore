// apps/web/src/hooks/usePharma.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-fetch';

const API_BASE = '/v1/pharma';

export type InteractionType = 'CALL' | 'MEETING' | 'EMAIL' | 'LUNCH' | 'CONFERENCE' | 'OTHER';

export interface PharmaContact {
  id: string;
  organizationId: string;
  name: string;
  company: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PharmaInteraction {
  id: string;
  organizationId: string;
  contactId: string;
  date: string;
  type: InteractionType;
  notes: string | null;
  followUpNeeded: boolean;
  createdAt: string;
}

interface ListContactsResponse {
  items: PharmaContact[];
  total: number;
  page: number;
  pageSize: number;
}

interface ListInteractionsResponse {
  items: PharmaInteraction[];
}

const pharmaKeys = {
  all: ['pharma'] as const,
  contacts: (params: Record<string, unknown>) => [...pharmaKeys.all, 'contacts', params] as const,
  interactions: (contactId: string) => [...pharmaKeys.all, 'interactions', contactId] as const,
};

export function usePharmaContacts(params?: { page?: number; pageSize?: number; company?: string }) {
  const queryParams = new URLSearchParams();
  queryParams.set('page', String(params?.page ?? 1));
  queryParams.set('pageSize', String(params?.pageSize ?? 20));
  if (params?.company) queryParams.set('company', params.company);

  return useQuery<ListContactsResponse>({
    queryKey: pharmaKeys.contacts(params ?? {}),
    queryFn: async () => {
      const res = await apiFetch<{ data: ListContactsResponse } | ListContactsResponse>(
        `${API_BASE}/contacts?${queryParams.toString()}`,
      );
      return 'data' in res ? (res as { data: ListContactsResponse }).data : (res as ListContactsResponse);
    },
  });
}

export function usePharmaInteractions(contactId: string | null) {
  return useQuery<ListInteractionsResponse>({
    queryKey: pharmaKeys.interactions(contactId ?? ''),
    queryFn: async () => {
      const res = await apiFetch<{ data: ListInteractionsResponse } | ListInteractionsResponse>(
        `${API_BASE}/contacts/${contactId}/interactions`,
      );
      return 'data' in res ? (res as { data: ListInteractionsResponse }).data : (res as ListInteractionsResponse);
    },
    enabled: !!contactId,
  });
}

export function useCreatePharmaContact() {
  const queryClient = useQueryClient();
  return useMutation<PharmaContact, Error, Partial<PharmaContact>>({
    mutationFn: async (input) => {
      const res = await apiFetch<{ data: PharmaContact } | PharmaContact>(`${API_BASE}/contacts`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return 'data' in res ? (res as { data: PharmaContact }).data : (res as PharmaContact);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...pharmaKeys.all, 'contacts'] });
    },
  });
}

export function useCreatePharmaInteraction() {
  const queryClient = useQueryClient();
  return useMutation<
    PharmaInteraction,
    Error,
    { contactId: string; type?: InteractionType; notes?: string; followUpNeeded?: boolean; date?: string }
  >({
    mutationFn: async (input) => {
      const { contactId, ...body } = input;
      const res = await apiFetch<{ data: PharmaInteraction } | PharmaInteraction>(
        `${API_BASE}/contacts/${contactId}/interactions`,
        { method: 'POST', body: JSON.stringify(body) },
      );
      return 'data' in res ? (res as { data: PharmaInteraction }).data : (res as PharmaInteraction);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: pharmaKeys.interactions(variables.contactId) });
      queryClient.invalidateQueries({ queryKey: [...pharmaKeys.all, 'contacts'] });
    },
  });
}
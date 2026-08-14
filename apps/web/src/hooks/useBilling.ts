// apps/web/src/hooks/useBilling.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-fetch';

const API_BASE = '/v1/billing';

export type BillingType = 'CONSULTATION' | 'SURGERY' | 'TREATMENT' | 'SUBSCRIPTION' | 'OTHER';
export type BillingStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED';

export interface BillingTransaction {
  id: string;
  organizationId: string;
  patientId: string | null;
  consultationId: string | null;
  surgeryId: string | null;
  amount: number;
  type: BillingType;
  status: BillingStatus;
  description: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingStatsResponse {
  data: {
    totalThisMonth: number;
    change: { value: number; percent: number; period: 'month' };
    monthly: Array<{ month: string; total: number }>;
    byType: Record<string, number>;
  };
}

interface ListResponse {
  items: BillingTransaction[];
  total: number;
  page: number;
  pageSize: number;
}

const billingKeys = {
  all: ['billing'] as const,
  list: (params: Record<string, unknown>) => [...billingKeys.all, 'list', params] as const,
  stats: () => [...billingKeys.all, 'stats'] as const,
};

export function useBillingTransactions(params?: {
  page?: number;
  pageSize?: number;
  type?: BillingType;
  status?: BillingStatus;
  from?: string;
  to?: string;
}) {
  const queryParams = new URLSearchParams();
  queryParams.set('page', String(params?.page ?? 1));
  queryParams.set('pageSize', String(params?.pageSize ?? 20));
  if (params?.type) queryParams.set('type', params.type);
  if (params?.status) queryParams.set('status', params.status);
  if (params?.from) queryParams.set('from', params.from);
  if (params?.to) queryParams.set('to', params.to);

  return useQuery<ListResponse>({
    queryKey: billingKeys.list(params ?? {}),
    queryFn: async () => {
      const res = await apiFetch<{ data: ListResponse } | ListResponse>(
        `${API_BASE}/transactions?${queryParams.toString()}`,
      );
      return 'data' in res ? (res as { data: ListResponse }).data : (res as ListResponse);
    },
  });
}

export function useBillingStats() {
  return useQuery<BillingStatsResponse['data']>({
    queryKey: billingKeys.stats(),
    queryFn: async () => {
      const res = await apiFetch<BillingStatsResponse>(`${API_BASE}/stats`);
      return res.data;
    },
  });
}

export function useCreateBillingTransaction() {
  const queryClient = useQueryClient();
  return useMutation<BillingTransaction, Error, Partial<BillingTransaction>>({
    mutationFn: async (input) => {
      const res = await apiFetch<{ data: BillingTransaction } | BillingTransaction>(
        `${API_BASE}/transactions`,
        { method: 'POST', body: JSON.stringify(input) },
      );
      return 'data' in res ? (res as { data: BillingTransaction }).data : (res as BillingTransaction);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
}

export interface UpdateBillingTransactionInput {
  amount?: number;
  type?: BillingType;
  status?: BillingStatus;
  description?: string | null;
  date?: string;
  patientId?: string | null;
}

/**
 * Updates a billing transaction via PATCH /v1/billing/transactions/:id.
 * NOTE: the matching backend PATCH endpoint is added in a later phase; the hook
 * is wired now so the UI layer can call it once the endpoint ships.
 */
export function useUpdateBillingTransaction() {
  const queryClient = useQueryClient();
  return useMutation<
    BillingTransaction,
    Error,
    { id: string; patch: UpdateBillingTransactionInput }
  >({
    mutationFn: async ({ id, patch }) => {
      const res = await apiFetch<{ data: BillingTransaction } | BillingTransaction>(
        `${API_BASE}/transactions/${id}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
      );
      return 'data' in res ? (res as { data: BillingTransaction }).data : (res as BillingTransaction);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
}
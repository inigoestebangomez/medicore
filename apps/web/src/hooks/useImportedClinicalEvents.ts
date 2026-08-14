import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import type { ImportedClinicalEvent, ImportedEventsPage } from '@medicore/contracts';
import { apiFetch, unwrapApiData } from '@/lib/api-fetch';

const PAGE_SIZE = 50;

export function buildImportedClinicalEventsUrl(patientId: string, cursor?: string): string {
  const params = new URLSearchParams({ pageSize: String(PAGE_SIZE) });
  if (cursor) params.set('cursor', cursor);
  return `/v1/patients/${patientId}/imported-events?${params.toString()}`;
}

export function useImportedClinicalEvents(patientId: string) {
  const query = useInfiniteQuery<
    ImportedEventsPage,
    Error,
    InfiniteData<ImportedEventsPage>,
    readonly ['imported-clinical-events', string],
    string | undefined
  >({
    queryKey: ['imported-clinical-events', patientId],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const response = await apiFetch<ImportedEventsPage | { data: ImportedEventsPage }>(
        buildImportedClinicalEventsUrl(patientId, pageParam),
      );
      return unwrapApiData(response);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(patientId),
  });

  return {
    ...query,
    items: query.data?.pages.flatMap((page) => page.items) ?? ([] as ImportedClinicalEvent[]),
    truncated: query.data?.pages.some((page) => page.truncated) ?? false,
    loadMore: () => query.fetchNextPage(),
  };
}

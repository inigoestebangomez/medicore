// apps/web/src/features/guided-analysis/api/useGuidedAnalysis.ts
// React Query hooks for the guided statistical analysis API.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  GuidedAnalysisRequest,
  GuidedAnalysisResult,
} from '@medicore/contracts';

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  const json = await res.json();
  return (json as { data: T }).data;
}

export async function runGuidedAnalysis(
  request: GuidedAnalysisRequest,
): Promise<GuidedAnalysisResult> {
  return apiFetch<GuidedAnalysisResult>('/api/research/guided/analyses', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function useGuidedAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: runGuidedAnalysis,
    onSuccess: () => {
      // Invalidate any related queries
      queryClient.invalidateQueries({ queryKey: ['research', 'guided'] });
    },
  });
}

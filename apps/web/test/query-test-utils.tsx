// apps/web/test/query-test-utils.tsx
// Test helper: wraps a component in a fresh TanStack Query client so hooks that
// call useQuery/useMutation render in unit tests. Mirrors the convention used
// across the web app's feature tests.

import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(
  ui: ReactNode,
  { client = makeQueryClient(), ...rest }: RenderOptions & { client?: QueryClient } = {},
): RenderResult {
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>, rest);
}
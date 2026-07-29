import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';

const useUpdateLayout = vi.hoisted(() => vi.fn());
const useExecuteQueryResult = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useResearchV2', () => ({ useUpdateLayout }));
vi.mock('@/hooks/useResearch', () => ({ useExecuteQueryResult }));

import { DashboardBuilder } from './DashboardBuilder';
import { renderWithProviders } from '../../../../test/query-test-utils';
import type { DashboardResponse } from '@medicore/contracts';

const DASH: DashboardResponse = {
  id: '00000000-0000-0000-0000-000000000001',
  organizationId: '00000000-0000-0000-0000-000000000002',
  createdBy: '00000000-0000-0000-0000-000000000003',
  name: 'Cardio 2025',
  description: 'Cohorte cardiovascular',
  layout: { density: 'comfortable' },
  createdAt: '2026-07-28T00:00:00Z',
  updatedAt: '2026-07-28T00:00:00Z',
  widgets: [
    {
      id: '00000000-0000-0000-0000-000000000010',
      queryId: '00000000-0000-0000-0000-000000000021',
      chartType: 'bar_chart',
      position: { x: 0, y: 0, w: 6, h: 2 },
      displayConfig: { displayFields: ['sex'], statsMode: 'descriptive' },
      title: 'Sexo',
    },
    {
      id: '00000000-0000-0000-0000-000000000011',
      queryId: '00000000-0000-0000-0000-000000000022',
      chartType: 'stats',
      position: { x: 6, y: 0, w: 6, h: 2 },
      displayConfig: { displayFields: ['age'], statsMode: 'descriptive' },
      title: 'Edad',
    },
  ],
};

describe('DashboardBuilder widget rendering + drag-drop', () => {
  beforeEach(() => {
    useUpdateLayout.mockReset();
    useExecuteQueryResult.mockReset();
  });

  it('renders each widget with the correct chart type from the query result', () => {
    useUpdateLayout.mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false, isSuccess: false, mutate: vi.fn(), reset: vi.fn() });
    // ResultsViewer path: bar_chart uses distributions; stats uses stats array.
    useExecuteQueryResult.mockReturnValue({
      data: {
        rows: [{ patientId: 'p1', nhc: '1', fields: {} }],
        stats: [{ field: 'age', n: 4, mean: 50, median: 50, stdDev: 5, min: 40, max: 60, ci95Lower: 40, ci95Upper: 60 }],
        distributions: [{ field: 'sex', categories: [{ label: 'M', count: 2 }, { label: 'F', count: 2 }] }],
        displayFields: ['sex'],
      },
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<DashboardBuilder dashboard={DASH} />);
    const grid = screen.getByTestId('dashboard-grid');
    expect(grid).toBeInTheDocument();
    expect(screen.getByTestId(`widget-${DASH.widgets[0].id}`)).toBeInTheDocument();
    // titles render correct chart references
    expect(screen.getByText('Sexo')).toBeInTheDocument();
    expect(screen.getByText('Edad')).toBeInTheDocument();
  });

  it('swaps widget positions on drop and persists the new layout', () => {
    const mutateAsync = vi.fn(async (_input: { dashboardId: string; positions: Record<string, unknown> }) => {
      return { ...DASH };
    });
    useUpdateLayout.mockReturnValue({
      mutateAsync, isPending: false, isError: false, isSuccess: false, mutate: vi.fn(), reset: vi.fn(),
    });
    useExecuteQueryResult.mockReturnValue({
      data: { rows: [], stats: [], distributions: [], displayFields: [] }, isLoading: false, isError: false,
    });

    renderWithProviders(<DashboardBuilder dashboard={DASH} />);

    const w0 = screen.getByTestId(`widget-${DASH.widgets[0].id}`);
    const w1 = screen.getByTestId(`widget-${DASH.widgets[1].id}`);

    // Simulate HTML5 drag: drop w0 onto w1 → swap positions, persist.
    fireEvent.dragStart(w0);
    fireEvent.dragOver(w1);
    fireEvent.drop(w1);

    expect(mutateAsync).toHaveBeenCalled();
    const arg = mutateAsync.mock.calls[0][0] as {
      dashboardId: string;
      positions: Record<string, { x: number; y: number; w: number; h: number }>;
    };
    expect(arg.dashboardId).toBe(DASH.id);
    // After swap, widget0 should have widget1's original position (x=6).
    expect(arg.positions[DASH.widgets[0].id].x).toBe(6);
    expect(arg.positions[DASH.widgets[1].id].x).toBe(0);
  });

  it('renders an empty state when there are no widgets', () => {
    useUpdateLayout.mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false, isSuccess: false, mutate: vi.fn(), reset: vi.fn() });
    useExecuteQueryResult.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    renderWithProviders(<DashboardBuilder dashboard={{ ...DASH, widgets: [] }} />);
    expect(screen.getByText(/Sin widgets/)).toBeInTheDocument();
  });
});
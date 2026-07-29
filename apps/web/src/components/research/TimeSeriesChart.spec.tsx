import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

// Mock recharts to avoid jsdom/ResizeObserver measurement issues. Each chart
// renders a lightweight testid container so we assert presence + props.
vi.mock('recharts', () => ({
  ComposedChart: ({ children, data }: any) => <div data-testid="composed-chart" data-points={data?.length ?? 0}>{children}</div>,
  Area: () => <div data-testid="area" />,
  Line: () => <div data-testid="line" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive">{children}</div>,
  ReferenceLine: () => null,
}));

const useTimeSeries = vi.hoisted(() => vi.fn());
const useInferential = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useResearchV2', () => ({ useTimeSeries, useInferential }));

import { TimeSeriesChart } from './TimeSeriesChart';
import { SurvivalCurve } from './SurvivalCurve';
import { renderWithProviders } from '../../../test/query-test-utils';
import type { TimeSeriesResult, SurvivalResult } from '@medicore/contracts';

describe('TimeSeriesChart', () => {
  beforeEach(() => useTimeSeries.mockReset());

  it('renders the line/area chart from grouped points and empty periods as zero', () => {
    const ts: TimeSeriesResult = {
      metric: 'surgeries', period: 'month',
      points: [{ period: '2026-01', count: 0 }, { period: '2026-02', count: 5 }, { period: '2026-03', count: 8 }],
      trendSlope: 4.0,
    };
    useTimeSeries.mockReturnValue({ data: ts, isLoading: false, isError: false });

    renderWithProviders(<TimeSeriesChart metric="surgeries" period="month" />);
    // Empty period (zero) is part of the data — axis does not break.
    const chart = screen.getByTestId('composed-chart');
    expect(chart.getAttribute('data-points')).toBe(String(ts.points.length));
    expect(screen.getByTestId('area')).toBeInTheDocument();
    expect(screen.getByTestId('line')).toBeInTheDocument();
    expect(screen.getByText(/pendiente 4.000/)).toBeInTheDocument();
  });

  it('renders loading + error states', () => {
    useTimeSeries.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { unmount } = renderWithProviders(<TimeSeriesChart metric="surgeries" />);
    expect(screen.getByText(/Calculando serie temporal/)).toBeInTheDocument();
    unmount();

    useTimeSeries.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderWithProviders(<TimeSeriesChart metric="surgeries" />);
    expect(screen.getByText(/Error al calcular/)).toBeInTheDocument();
  });
});

describe('SurvivalCurve (Kaplan-Meier)', () => {
  const KM: SurvivalResult = {
    timePoints: [0, 1, 2, 3, 4],
    survival: [1, 0.9, 0.75, 0.6, 0.4],
    ciLower: [1, 0.85, 0.68, 0.52, 0.32],
    ciUpper: [1, 1, 0.83, 0.7, 0.5],
    riskTable: [],
    logRankP: 0.02,
    medianSurvival: 3.5,
    warnings: [],
  };

  beforeEach(() => useInferential.mockReset());

  it('renders the KM curve + CI band from sample data', () => {
    useInferential.mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false, data: undefined, mutate: vi.fn(), reset: vi.fn() });
    renderWithProviders(<SurvivalCurve data={KM} />);
    expect(screen.getByTestId('survival-curve')).toBeInTheDocument();
    expect(screen.getByTestId('composed-chart').getAttribute('data-points')).toBe(String(KM.timePoints.length));
    // Two areas for the CI band, one survival line.
    expect(screen.getAllByTestId('area').length).toBe(2);
    expect(screen.getByText(/Median survival = 3.5/)).toBeInTheDocument();
    expect(screen.getByText(/log-rank p = 0.020/)).toBeInTheDocument();
  });

  it('shows a degraded warning when inferential stats are unavailable', () => {
    useInferential.mockReturnValue({
      mutateAsync: vi.fn(), isPending: false, isError: false,
      data: { test: 'kaplan_meier', warnings: [{ code: 'inferential_stats_unavailable', message: 'timeout' }] } as any,
      mutate: vi.fn(), reset: vi.fn(),
    });
    renderWithProviders(<SurvivalCurve queryId="q1" />);
    expect(screen.getByText(/Inferential stats unavailable/)).toBeInTheDocument();
  });
});
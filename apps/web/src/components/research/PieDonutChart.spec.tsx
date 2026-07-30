// apps/web/src/components/research/PieDonutChart.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

vi.mock('recharts', () => ({
  PieChart: ({ children }: any) => <div data-testid="pie-svg">{children}</div>,
  Pie: ({ data }: any) => <div data-testid="pie" data-cats={data?.length ?? 0} />,
  Cell: () => null, Tooltip: () => null, Legend: () => null,
  BarChart: ({ data }: any) => <div data-testid="bar-chart" data-cats={data?.length ?? 0} />,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => null, YAxis: () => null, CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive">{children}</div>,
}));

const useFeatureFlag = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useFeatureFlag', () => ({ useFeatureFlag }));

vi.mock('./ExportChartButton', () => ({
  ExportChartButton: ({ fileName }: any) => <span data-testid="export-btn" data-file={fileName} />,
}));

import { PieDonutChart } from './PieDonutChart';
import { renderWithProviders } from '../../../test/query-test-utils';

const CATS_3 = [
  { label: 'A', count: 10 },
  { label: 'B', count: 8 },
  { label: 'C', count: 4 },
];

const CATS_7 = Array.from({ length: 7 }, (_, i) => ({ label: `g${i}`, count: 3 }));

describe('PieDonutChart', () => {
  beforeEach(() => useFeatureFlag.mockReset());

  it('renders the pie chart when<=5 categories and N>=5', () => {
    useFeatureFlag.mockReturnValue(true);
    renderWithProviders(<PieDonutChart field="sex" categories={CATS_3} />);
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByTestId('pie').getAttribute('data-cats')).toBe('3');
  });

  it('falls back to a bar chart with a warning when >5 categories', () => {
    useFeatureFlag.mockReturnValue(true);
    renderWithProviders(<PieDonutChart field="group" categories={CATS_7} />);
    expect(screen.queryByTestId('pie')).toBeNull();
    expect(screen.getByTestId('pie-fallback-bar')).toBeInTheDocument();
    expect(screen.getByTestId('pie-fallback-warning').textContent).toContain('>5 categorías');
    expect(screen.getByTestId('bar-chart').getAttribute('data-cats')).toBe('5');
  });

  it('shows insufficient-sample warning when N<5', () => {
    useFeatureFlag.mockReturnValue(true);
    renderWithProviders(<PieDonutChart field="x" categories={[{ label: 'A', count: 2 }, { label: 'B', count: 1 }]} />);
    expect(screen.getByText(/Muestra insuficiente/)).toBeInTheDocument();
  });

  it('shows disabled hint when flag OFF', () => {
    useFeatureFlag.mockReturnValue(false);
    renderWithProviders(<PieDonutChart field="x" categories={CATS_3} />);
    expect(screen.getByText(/RESEARCH_V3_VIZ/)).toBeInTheDocument();
  });
});
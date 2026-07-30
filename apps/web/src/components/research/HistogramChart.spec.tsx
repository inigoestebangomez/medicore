// apps/web/src/components/research/HistogramChart.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

// Mock recharts to avoid ResizeObserver/measurement issues under jsdom.
vi.mock('recharts', () => ({
  ComposedChart: ({ children }: any) => <div data-testid="composed-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  Line: () => <div data-testid="line" />,
  XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive">{children}</div>,
}));

const useFeatureFlag = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useFeatureFlag', () => ({ useFeatureFlag }));

// ExportChartButton mock avoids canvas/Image in jsdom.
vi.mock('./ExportChartButton', () => ({
  ExportChartButton: ({ fileName }: any) => <span data-testid="export-btn" data-file={fileName} />,
}));

import { HistogramChart } from './HistogramChart';
import { renderWithProviders } from '../../../test/query-test-utils';

const SAMPLE = [1, 2, 2, 3, 3, 3, 4, 4, 5, 6, 7, 8];

describe('HistogramChart', () => {
  beforeEach(() => useFeatureFlag.mockReset());

  it('renders the histogram + normal-density overlay when flag ON and N>=5', () => {
    useFeatureFlag.mockReturnValue(true);
    renderWithProviders(<HistogramChart field="age" values={SAMPLE} />);
    expect(screen.getByTestId('histogram-chart')).toBeInTheDocument();
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
    expect(screen.getByTestId('bar')).toBeInTheDocument();
    expect(screen.getByTestId('line')).toBeInTheDocument();
  });

  it('shows the footer with N value', () => {
    useFeatureFlag.mockReturnValue(true);
    renderWithProviders(<HistogramChart field="age" values={SAMPLE} test="Shapiro-Wilk" />);
    expect(screen.getByTestId('chart-footer').textContent).toContain('N = 12');
    expect(screen.getByTestId('chart-footer').textContent).toContain('Shapiro-Wilk');
  });

  it('hides and warns when N<5 (BR-RES-004)', () => {
    useFeatureFlag.mockReturnValue(true);
    renderWithProviders(<HistogramChart field="age" values={[1, 2, 3]} />);
    expect(screen.queryByTestId('histogram-chart')).toBeNull();
    expect(screen.getByText(/Muestra insuficiente/)).toBeInTheDocument();
  });

  it('shows disabled hint when flag OFF', () => {
    useFeatureFlag.mockReturnValue(false);
    renderWithProviders(<HistogramChart field="age" values={SAMPLE} />);
    expect(screen.getByText(/RESEARCH_V3_VIZ/)).toBeInTheDocument();
    expect(screen.queryByTestId('histogram-chart')).toBeNull();
  });
});
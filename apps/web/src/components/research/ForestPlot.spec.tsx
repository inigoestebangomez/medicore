// apps/web/src/components/research/ForestPlot.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

const useFeatureFlag = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useFeatureFlag', () => ({ useFeatureFlag }));

vi.mock('./ExportChartButton', () => ({
  ExportChartButton: ({ fileName }: any) => <span data-testid="export-btn" data-file={fileName} />,
}));

import { ForestPlot } from './ForestPlot';
import { renderWithProviders } from '../../../test/query-test-utils';

const ROWS = [
  { label: 'Study A', estimate: 1.4, ciLower: 0.9, ciUpper: 2.1, weight: 30 },
  { label: 'Study B', estimate: 0.8, ciLower: 0.5, ciUpper: 1.3, weight: 20 },
  { label: 'Pooled', estimate: 1.1, ciLower: 0.8, ciUpper: 1.5, weight: 100 },
];

describe('ForestPlot', () => {
  beforeEach(() => useFeatureFlag.mockReset());

  it('renders rows with estimate points and CI whiskers when flag ON', () => {
    useFeatureFlag.mockReturnValue(true);
    renderWithProviders(<ForestPlot rows={ROWS} />);
    expect(screen.getByTestId('forest-plot')).toBeInTheDocument();
    expect(screen.getByText('Study A')).toBeInTheDocument();
    expect(screen.getByText('Pooled')).toBeInTheDocument();
    expect(screen.getByTestId('chart-footer').textContent).toContain('N = 3');
  });

  it('renders the null-effect vertical reference line at 1.0 by default', () => {
    useFeatureFlag.mockReturnValue(true);
    const { container } = renderWithProviders(<ForestPlot rows={ROWS} />);
    // The dashed vertical reference is the only strokeDasharray="4 3" line touching both axes y bounds.
    const refs = container.querySelectorAll('line[stroke-dasharray="4 3"]');
    expect(refs.length).toBeGreaterThanOrEqual(1);
  });

  it('accepts a custom nullEffect (0 for Risk Difference)', () => {
    useFeatureFlag.mockReturnValue(true);
    renderWithProviders(<ForestPlot rows={ROWS} nullEffect={0} effectLabel="Risk Difference" />);
    expect(screen.getByText('Risk Difference')).toBeInTheDocument();
  });

  it('shows empty hint when rows array is empty', () => {
    useFeatureFlag.mockReturnValue(true);
    renderWithProviders(<ForestPlot rows={[]} />);
    expect(screen.getByText(/Sin datos para el forest plot/)).toBeInTheDocument();
  });

  it('shows disabled hint when flag OFF', () => {
    useFeatureFlag.mockReturnValue(false);
    renderWithProviders(<ForestPlot rows={ROWS} />);
    expect(screen.getByText(/RESEARCH_V3_VIZ/)).toBeInTheDocument();
    expect(screen.queryByTestId('forest-plot')).toBeNull();
  });
});
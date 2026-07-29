import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

const useCrossTab = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useResearchV2', () => ({ useCrossTab }));

import { CrossTabViewer } from './CrossTabViewer';
import type { CrossTabResult } from '@medicore/contracts';
import { renderWithProviders } from '../../../test/query-test-utils';

const RESULT: CrossTabResult = {
  rowField: 'sex', colField: 'diagnosis',
  rows: ['M', 'F'],
  cols: ['AAA', 'BBB', 'CCC'],
  // row M: AAA=1 (suppressed, <5), BBB=12, CCC=3 (suppressed)
  // row F: AAA=8, BBB=2 (suppressed), CCC=20
  cells: [
    [{ count: 1, suppressed: true }, { count: 12, suppressed: false }, { count: 3, suppressed: true }],
    [{ count: 8, suppressed: false }, { count: 2, suppressed: true }, { count: 20, suppressed: false }],
  ],
  rowTotals: [16, 30],
  colTotals: [9, 14, 23],
  grandTotal: 46,
  chiSquare: 5.2, chiSquareP: 0.07, fisherExactP: null,
  oddsRatio: null, oddsRatioCi95: null,
  warnings: ['Some expected cells <5; consider Fisher exact (2x2).'],
};

describe('CrossTabViewer (BR-RES-004 N<5 suppression)', () => {
  beforeEach(() => useCrossTab.mockReset());

  it('suppresses cells with N<5 and renders the p-value footer', () => {
    useCrossTab.mockReturnValue({ data: RESULT, isLoading: false, isError: false });
    renderWithProviders(<CrossTabViewer rowField="sex" colField="diagnosis" />);

    // Suppressed cells render as <5 (there are several).
    expect(screen.getAllByText('<5').length).toBe(3);
    // Non-suppressed counts render numerically.
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    // Footer chi-square p-value
    expect(screen.getByText(/χ² p =/)).toBeInTheDocument();
    expect(screen.getByText('0.070')).toBeInTheDocument();
  });

  it('shows a loading state', () => {
    useCrossTab.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderWithProviders(<CrossTabViewer rowField="sex" colField="diagnosis" />);
    expect(screen.getByText(/Calculando cross-tab/)).toBeInTheDocument();
  });

  it('shows an error state', () => {
    useCrossTab.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderWithProviders(<CrossTabViewer rowField="sex" colField="diagnosis" />);
    expect(screen.getByText(/Error al calcular/)).toBeInTheDocument();
  });
});
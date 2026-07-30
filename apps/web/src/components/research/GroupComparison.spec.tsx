// apps/web/src/components/research/GroupComparison.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';

const useFeatureFlag = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useFeatureFlag', () => ({ useFeatureFlag }));

type MutShape = { mutateAsync: any; data: unknown; isPending: boolean; isError: boolean };
const useGroupComparison = vi.hoisted<MutShape>(() => ({
  mutateAsync: vi.fn(),
  data: null,
  isPending: false,
  isError: false,
}));
vi.mock('@/hooks/useStudiesWithBadges', async () => {
  const actual = await vi.importActual<any>('@/hooks/useStudiesWithBadges');
  return { ...actual, useGroupComparison: () => useGroupComparison };
});

import { GroupComparison } from './GroupComparison';
import { renderWithProviders } from '../../../test/query-test-utils';

const RESULT = {
  queryId: 'q1', groupBy: 'sex', groups: ['M', 'F'], warnings: [],
  variables: [
    {
      field: 'age', test: 'ttest_independent', pValue: '0.050', statistic: 2.1,
      groups: [
        { key: 'M', n: 6, representation: 'mean_sd', mean: 33, sd: 2.1, median: null, q1: null, q3: null, categories: [] },
        { key: 'F', n: 6, representation: 'mean_sd', mean: 27, sd: 1.8, median: null, q1: null, q3: null, categories: [] },
      ],
      warnings: [],
    },
    {
      field: 'smoker', test: 'fisher_exact', pValue: '<0.001', statistic: 0.3,
      groups: [
        { key: 'M', n: 6, representation: 'categorical', mean: null, sd: null, median: null, q1: null, q3: null, categories: [{ label: 'yes', count: 4, percent: 66.7 }] },
        { key: 'F', n: 6, representation: 'categorical', mean: null, sd: null, median: null, q1: null, q3: null, categories: [{ label: 'yes', count: 1, percent: 16.7 }] },
      ],
      warnings: [],
    },
  ],
};

function reset() {
  useGroupComparison.mutateAsync = vi.fn(async () => RESULT);
  useGroupComparison.data = null;
  useGroupComparison.isPending = false;
  useGroupComparison.isError = false;
}

describe('GroupComparison', () => {
  beforeEach(() => { useFeatureFlag.mockReturnValue(true); reset(); });

  it('renders the group selector and default variable checkboxes', () => {
    renderWithProviders(<GroupComparison studyId="s1" />);
    expect(screen.getByLabelText('Agrupar por')).toHaveValue('sex');
    expect(screen.getByLabelText('variable age')).toBeInTheDocument();
    expect(screen.getByLabelText('variable age')).toBeChecked();
    expect(screen.getByLabelText('variable smoker')).toBeChecked();
  });

  it('toggles variable selection', () => {
    renderWithProviders(<GroupComparison studyId="s1" />);
    fireEvent.click(screen.getByLabelText('variable smoker'));
    expect(screen.getByLabelText('variable smoker')).not.toBeChecked();
    fireEvent.click(screen.getByLabelText('variable smoker'));
    expect(screen.getByLabelText('variable smoker')).toBeChecked();
  });

  it('calls mutateAsync with the configured request', async () => {
    renderWithProviders(<GroupComparison studyId="s1" />);
    fireEvent.change(screen.getByLabelText('Agrupar por'), { target: { value: 'group' } });
    fireEvent.click(screen.getByText('Comparar grupos'));
    await waitFor(() => expect(useGroupComparison.mutateAsync).toHaveBeenCalled());
    expect(useGroupComparison.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ studyId: 's1', groupBy: 'group', variableFields: expect.arrayContaining(['age', 'smoker']) }),
    );
  });

  it('renders the comparison table with test labels and formatted p-values', () => {
    useGroupComparison.data = RESULT;
    renderWithProviders(<GroupComparison studyId="s1" />);
    expect(screen.getByTestId('comparison-table')).toBeInTheDocument();
    expect(screen.getByTestId('p-age').textContent).toBe('0.050');
    expect(screen.getByTestId('p-smoker').textContent).toBe('<0.001');
    expect(screen.getAllByText('t de Student').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Fisher').length).toBeGreaterThan(0);
  });

  it('shows error message when mutation fails', () => {
    useGroupComparison.isError = true;
    renderWithProviders(<GroupComparison studyId="s1" />);
    expect(screen.getByText(/Error al comparar grupos/)).toBeInTheDocument();
  });

  it('shows disabled hint when flag OFF', () => {
    useFeatureFlag.mockReturnValue(false);
    renderWithProviders(<GroupComparison studyId="s1" />);
    expect(screen.getByText(/RESEARCH_V3_VIZ/)).toBeInTheDocument();
  });
});
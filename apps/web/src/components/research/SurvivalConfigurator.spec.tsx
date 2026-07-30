// apps/web/src/components/research/SurvivalConfigurator.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';

const useFeatureFlag = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useFeatureFlag', () => ({ useFeatureFlag }));

type MutShape = { mutateAsync: any; data: unknown; isPending: boolean };
const useSurvivalTable = vi.hoisted<MutShape>(() => ({
  mutateAsync: vi.fn(),
  data: null,
  isPending: false,
}));
vi.mock('@/hooks/useStudiesWithBadges', async () => {
  const actual = await vi.importActual<any>('@/hooks/useStudiesWithBadges');
  return { ...actual, useSurvivalTable: () => useSurvivalTable };
});

import { SurvivalConfigurator } from './SurvivalConfigurator';
import { renderWithProviders } from '../../../test/query-test-utils';

const RESULT = {
  queryId: 'q1', timeField: 'followUpMonths', eventField: 'event_recurrence',
  n: 12, medianSurvival: 24, logRankP: 0.02, warnings: [],
  rows: [
    { months: 6, survival: 0.95, ciLower: 0.9, ciUpper: 1 },
    { months: 36, survival: 0.5, ciLower: 0.4, ciUpper: 0.6 },
  ],
  csv: 'months,survival,ci_lower,ci_upper\n6,0.95,0.9,1',
};

function reset() {
  useSurvivalTable.mutateAsync = vi.fn(async () => RESULT);
  useSurvivalTable.data = null;
  useSurvivalTable.isPending = false;
}

describe('SurvivalConfigurator', () => {
  beforeEach(() => { useFeatureFlag.mockReturnValue(true); reset(); });

  it('renders default event type selector and fields', () => {
    renderWithProviders(<SurvivalConfigurator studyId="s1" />);
    expect(screen.getByLabelText('Tipo de evento')).toHaveValue('recurrence');
    expect(screen.getByLabelText('Campo tiempo')).toHaveValue('followUpMonths');
  });

  it('switches to custom event field input when "custom" selected', () => {
    renderWithProviders(<SurvivalConfigurator studyId="s1" />);
    fireEvent.change(screen.getByLabelText('Tipo de evento'), { target: { value: 'custom' } });
    expect(screen.getByLabelText('Campo evento personalizado')).toBeInTheDocument();
  });

  it('calls mutateAsync with the derived event field and renders the table', async () => {
    renderWithProviders(<SurvivalConfigurator studyId="s1" />);
    fireEvent.click(screen.getByText('Generar tabla de supervivencia'));
    await waitFor(() => expect(useSurvivalTable.mutateAsync).toHaveBeenCalled());
    expect(useSurvivalTable.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ studyId: 's1', timeField: 'followUpMonths', eventField: 'event_recurrence' }),
    );
  });

  it('renders the survival table rows and CSV download button once data arrives', () => {
    useSurvivalTable.data = RESULT;
    renderWithProviders(<SurvivalConfigurator studyId="s1" />);
    expect(screen.getByTestId('survival-table')).toBeInTheDocument();
    expect(screen.getByText('0.95')).toBeInTheDocument();
    expect(screen.getByTestId('download-csv')).toBeInTheDocument();
  });

  it('shows disabled hint when flag OFF', () => {
    useFeatureFlag.mockReturnValue(false);
    renderWithProviders(<SurvivalConfigurator studyId="s1" />);
    expect(screen.getByText(/RESEARCH_V3_VIZ/)).toBeInTheDocument();
  });
});
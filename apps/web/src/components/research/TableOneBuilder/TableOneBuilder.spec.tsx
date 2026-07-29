// apps/web/src/components/research/TableOneBuilder/TableOneBuilder.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/query-test-utils';

type MutShape = {
  mutateAsync: any;
  data: unknown;
  isPending: boolean;
};

const useTableOne = vi.hoisted((): MutShape => ({
  mutateAsync: vi.fn(),
  data: null,
  isPending: false,
}));
const useTableOneCompare = vi.hoisted((): MutShape => ({
  mutateAsync: vi.fn(),
  data: null,
  isPending: false,
}));

// Mock useTableOne/Compare to control mutation state and capture requests.
vi.mock('@/hooks/useStudiesWithBadges', async () => {
  const actual = await vi.importActual<any>('@/hooks/useStudiesWithBadges');
  return { ...actual, useTableOne: () => useTableOne, useTableOneCompare: () => useTableOneCompare };
});

import { TableOneBuilder } from './TableOneBuilder';

const PREVIEW = {
  queryId: 'q',
  totalN: 3,
  groupBy: undefined,
  warnings: [],
  fields: [
    {
      field: 'age', n: 3, representation: 'mean_sd' as const,
      mean: 55, sd: 5, median: null, q1: null, q3: null,
      categories: [],
    },
    {
      field: 'sex', n: 3, representation: 'categorical' as const,
      mean: null, sd: null, median: null, q1: null, q3: null,
      categories: [
        { label: 'M', count: 2, percent: 66.7 },
        { label: 'F', count: 1, percent: 33.3 },
      ],
    },
  ],
};

function resetMut(m: MutShape) {
  m.mutateAsync = vi.fn(async () => PREVIEW);
  m.data = null;
  m.isPending = false;
}

describe('TableOneBuilder', () => {
  beforeEach(() => {
    resetMut(useTableOne);
    resetMut(useTableOneCompare);
  });

  it('renders available-field chips and an override toggle per field', () => {
    renderWithProviders(<TableOneBuilder studyId="s1" availableFields={['age', 'sex']} />);
    // 'age' appears both as a chip label and a StatOverrideToggle label;
    // there are 2 occurrences (one per field).
    expect(screen.getAllByText('age').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('sex').length).toBeGreaterThanOrEqual(1);
    // one radiogroup per field (2 total)
    expect(screen.getAllByRole('radiogroup').length).toBe(2);
    expect(screen.getByText('Generar Tabla 1')).toBeInTheDocument();
  });

  it('removes a field when its chip remove button is clicked', () => {
    renderWithProviders(<TableOneBuilder studyId="s1" availableFields={['age', 'sex']} />);
    // Two chips → two remove buttons; remove the first.
    fireEvent.click(screen.getAllByLabelText('Quitar')[0]);
    // 'age' should no longer appear as a chip (the override toggle for 'age'
    // disappears too since overrides render per field).
    expect(screen.queryAllByText('age').length).toBe(0);
    expect(screen.getAllByText('sex').length).toBeGreaterThanOrEqual(1);
  });

  it('forces an override by clicking the median radiobutton', async () => {
    renderWithProviders(<TableOneBuilder studyId="s1" availableFields={['age']} />);
    fireEvent.click(screen.getByTestId('override-age-median_iqr'));
    fireEvent.click(screen.getByText('Generar Tabla 1'));
    await waitFor(() => expect(useTableOne.mutateAsync).toHaveBeenCalled());
    expect(useTableOne.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ overrides: { age: 'median_iqr' } }),
    );
  });

  it('reverts to auto by clicking the Auto radiobutton (drops the override key)', async () => {
    renderWithProviders(<TableOneBuilder studyId="s1" availableFields={['age']} />);
    fireEvent.click(screen.getByTestId('override-age-median_iqr'));
    fireEvent.click(screen.getByTestId('override-age-auto'));
    fireEvent.click(screen.getByText('Generar Tabla 1'));
    await waitFor(() => expect(useTableOne.mutateAsync).toHaveBeenCalled());
    expect(useTableOne.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ overrides: {} }),
    );
  });

  it('renders the preview table after a successful run', async () => {
    useTableOne.data = PREVIEW;
    renderWithProviders(<TableOneBuilder studyId="s1" availableFields={['age', 'sex']} />);
    expect(screen.getByText('Variable')).toBeInTheDocument();
    // numeric representation row
    expect(screen.getByText('55 ± 5')).toBeInTheDocument();
    // categorical representation row
    expect(screen.getByText(/M: 2 \(66\.7%\)/)).toBeInTheDocument();
  });

  it('uses the compare mutation when groupBy is selected', async () => {
    renderWithProviders(<TableOneBuilder studyId="s1" availableFields={['age']} />);
    const select = screen.getByRole('combobox');
    // group-by selector is sourced from SCALE_TYPES; pick one of them.
    fireEvent.change(select, { target: { value: 'NOSE' } });
    fireEvent.click(screen.getByText('Generar Tabla 1'));
    await waitFor(() => expect(useTableOneCompare.mutateAsync).toHaveBeenCalled());
    expect(useTableOneCompare.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ groupBy: 'NOSE' }),
    );
  });
});
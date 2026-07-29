// apps/web/src/components/research/PrePostAnalyzer/PrePostAnalyzer.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/query-test-utils';

type MutShape = {
  mutateAsync: any;
  data: unknown;
  isPending: boolean;
};

const usePrePostAnalysis = vi.hoisted((): MutShape => ({
  mutateAsync: vi.fn(),
  data: null,
  isPending: false,
}));

vi.mock('@/hooks/useStudiesWithBadges', async () => {
  const actual = await vi.importActual<any>('@/hooks/useStudiesWithBadges');
  return { ...actual, usePrePostAnalysis: () => usePrePostAnalysis };
});

import { PrePostAnalyzer } from './PrePostAnalyzer';

const RESULT = {
  studyId: 's1', scaleType: 'SNOT_22', n: 5,
  pValue: '<0.001', meanPre: 42, meanPost: 18, meanDifference: 24,
  percentImprovement: 57.1, warnings: [],
};

function reset() {
  usePrePostAnalysis.mutateAsync = vi.fn(async () => RESULT);
  usePrePostAnalysis.data = null;
  usePrePostAnalysis.isPending = false;
}

describe('PrePostAnalyzer', () => {
  beforeEach(reset);

  it('renders scale selector and window inputs with default values', () => {
    renderWithProviders(<PrePostAnalyzer studyId="s1" />);
    expect(screen.getByLabelText('Tipo de escala')).toHaveValue('SNOT_22');
    expect(screen.getByLabelText('Ventana pre días')).toHaveValue(30);
    expect(screen.getByLabelText('Ventana post días')).toHaveValue(15);
    expect(screen.getByText('Ejecutar análisis pre/post')).toBeInTheDocument();
  });

  it('changes scale via the selector', () => {
    renderWithProviders(<PrePostAnalyzer studyId="s1" />);
    fireEvent.change(screen.getByLabelText('Tipo de escala'), { target: { value: 'DHI' } });
    expect(screen.getByLabelText('Tipo de escala')).toHaveValue('DHI');
  });

  it('updates the pre/post windows from the number inputs', () => {
    renderWithProviders(<PrePostAnalyzer studyId="s1" />);
    fireEvent.change(screen.getByLabelText('Ventana pre días'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('Ventana post días'), { target: { value: '21' } });
    expect(screen.getByLabelText('Ventana pre días')).toHaveValue(60);
    expect(screen.getByLabelText('Ventana post días')).toHaveValue(21);
  });

  it('calls mutateAsync with the configured request (no surgeryDate when empty)', async () => {
    renderWithProviders(<PrePostAnalyzer studyId="s1" />);
    fireEvent.change(screen.getByLabelText('Ventana pre días'), { target: { value: '45' } });
    fireEvent.click(screen.getByText('Ejecutar análisis pre/post'));
    await waitFor(() => expect(usePrePostAnalysis.mutateAsync).toHaveBeenCalled());
    expect(usePrePostAnalysis.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ studyId: 's1', scaleType: 'SNOT_22', preWindowDays: 45, postWindowDays: 15 }),
    );
    // surgeryDate omitted when the field is empty
    expect((usePrePostAnalysis.mutateAsync.mock.calls[0][0] as any).surgeryDate).toBeUndefined();
  });

  it('includes surgeryDate when provided', async () => {
    renderWithProviders(<PrePostAnalyzer studyId="s1" />);
    fireEvent.change(screen.getByLabelText('Fecha de cirugía'), { target: { value: '2024-03-15' } });
    fireEvent.click(screen.getByText('Ejecutar análisis pre/post'));
    await waitFor(() => expect(usePrePostAnalysis.mutateAsync).toHaveBeenCalled());
    expect(usePrePostAnalysis.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ surgeryDate: '2024-03-15' }),
    );
  });

  it('renders results with formatted p-value and means after a run', async () => {
    usePrePostAnalysis.data = RESULT;
    renderWithProviders(<PrePostAnalyzer studyId="s1" />);
    expect(screen.getByTestId('pre-post-results')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('57.1%')).toBeInTheDocument();
    expect(screen.getByTestId('wilcoxon-p').textContent).toBe('<0.001');
  });
});
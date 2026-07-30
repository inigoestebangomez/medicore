// apps/web/src/components/research/ExportWizard/ExportWizard.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';

const useFeatureFlag = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useFeatureFlag', () => ({ useFeatureFlag }));

type MutShape = { mutateAsync: any; data: unknown; isPending: boolean; isError: boolean };
const useExportV3 = vi.hoisted<MutShape>(() => ({
  mutateAsync: vi.fn(),
  data: null,
  isPending: false,
  isError: false,
}));
vi.mock('@/hooks/useStudiesWithBadges', async () => {
  const actual = await vi.importActual<any>('@/hooks/useStudiesWithBadges');
  return {
    ...actual,
    useExportV3: () => useExportV3,
    getExportDownloadUrl: (id: string) => `/v1/research/export/v3/${id}/download`,
  };
});

import { ExportWizard } from './ExportWizard';
import { renderWithProviders } from '../../../../test/query-test-utils';

const JOB = { jobId: 'job-123', format: 'zip', filename: 'cohort-export.zip' };

function reset() {
  useExportV3.mutateAsync = vi.fn(async () => { useExportV3.data = JOB; return JOB; });
  useExportV3.data = null;
  useExportV3.isPending = false;
  useExportV3.isError = false;
}

describe('ExportWizard', () => {
  beforeEach(() => { useFeatureFlag.mockReturnValue(true); reset(); });

  it('renders the 3-step stepper and starts at step 1', () => {
    renderWithProviders(<ExportWizard studyId="s1" studyName="Cohort" />);
    expect(screen.getByText('1 · Formatos')).toBeInTheDocument();
    expect(screen.getByTestId('step-1').className).toContain('indigo');
  });

  it('lets the user toggle formats and advance to step 2', () => {
    renderWithProviders(<ExportWizard studyId="s1" studyName="Cohort" />);
    fireEvent.click(screen.getByLabelText('format zip'));
    expect(screen.getByLabelText('format zip')).toBeChecked();
    fireEvent.click(screen.getByText('Continuar'));
    expect(screen.getByText('2 · Configuración')).toBeInTheDocument();
  });

  it('changes citation style and dpi in step 2', () => {
    renderWithProviders(<ExportWizard studyId="s1" studyName="Cohort" />);
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.change(screen.getByLabelText('Estilo de citación'), { target: { value: 'Vancouver' } });
    fireEvent.change(screen.getByLabelText('DPI de la figura'), { target: { value: '600' } });
    expect(screen.getByLabelText('Estilo de citación')).toHaveValue('Vancouver');
    expect(screen.getByLabelText('DPI de la figura')).toHaveValue(600);
  });

  it('runs export on step 2 and advances to step 3 with a download link', async () => {
    renderWithProviders(<ExportWizard studyId="s1" studyName="Cohort" />);
    fireEvent.click(screen.getByLabelText('format zip'));
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(screen.getByTestId('run-export'));
    await waitFor(() => expect(useExportV3.mutateAsync).toHaveBeenCalled());
    expect(useExportV3.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      studyName: 'Cohort', formats: expect.arrayContaining(['docx', 'zip']), style: 'APA',
    }));
    await waitFor(() => expect(screen.getByTestId('export-results')).toBeInTheDocument());
    expect(screen.getByTestId('download-link').getAttribute('href')).toBe('/v1/research/export/v3/job-123/download');
    expect(screen.getByText(/cohort-export.zip/)).toBeInTheDocument();
  });

  it('shows disabled hint when flag OFF', () => {
    useFeatureFlag.mockReturnValue(false);
    renderWithProviders(<ExportWizard studyId="s1" studyName="Cohort" />);
    expect(screen.getByText(/RESEARCH_V3_EXPORT/)).toBeInTheDocument();
    expect(screen.queryByTestId('export-wizard')).toBeNull();
  });
});
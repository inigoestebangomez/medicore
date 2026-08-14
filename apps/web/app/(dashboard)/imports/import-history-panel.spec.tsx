import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportHistoryPanel } from './import-history-panel';

const history = vi.hoisted(() => vi.fn());
const resume = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useImports', () => ({
  useImportHistory: history,
}));

describe('ImportHistoryPanel', () => {
  beforeEach(() => {
    history.mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        items: [
          {
            id: 'failed-1', fileName: 'fallido.xlsx', originalFormat: 'xlsx', status: 'FAILED',
            errorMessage: 'NHC requiere resolución manual', totalRows: 10, importedRows: 3,
            enrichedRows: 1, createdRows: 2, skippedRows: 4, discardedRowCount: 2, createdAt: '2026-08-11T09:00:00.000Z', completedAt: null,
          },
          {
            id: 'confirming-1', fileName: 'pendiente.csv', originalFormat: 'csv', status: 'CONFIRMING',
            errorMessage: null, totalRows: 5, importedRows: 0, enrichedRows: 0, createdRows: 0,
            skippedRows: 0, createdAt: '2026-08-11T08:00:00.000Z', completedAt: null,
          },
        ], total: 2, page: 1, pageSize: 20,
      },
    });
  });

  it('renders failed errors and in-progress batches with counters', () => {
    render(<ImportHistoryPanel onResume={resume} />);

    expect(screen.getByText('fallido.xlsx')).toBeInTheDocument();
    expect(screen.getByText('Fallida')).toBeInTheDocument();
    expect(screen.getByText('NHC requiere resolución manual')).toBeInTheDocument();
    expect(screen.getByText('pendiente.csv')).toBeInTheDocument();
    expect(screen.getByText('Requiere confirmación')).toBeInTheDocument();
    expect(screen.getByText('Total: 10')).toBeInTheDocument();
    expect(screen.getByText('Omitidas automáticamente: 4')).toBeInTheDocument();
    expect(screen.getByText('Descartadas: 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument();
    screen.getByRole('button', { name: 'Continuar' }).click();
    expect(resume).toHaveBeenCalledWith('confirming-1');
  });
});

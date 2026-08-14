import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ImportedHistorySection } from './clinical-timeline';

const event = {
  id: 'batch-1-21-0', type: 'import' as const, date: '2026-01-02T00:00:00.000Z',
  batchId: 'batch-1', batchName: null, rowIndex: 21, rowIndices: [21, 22], rowGranularity: 'merged-block' as const,
  importedAt: '2026-01-03T00:00:00.000Z', sourceFormat: 'xlsx' as const,
  standardFields: { diagnosis: '<script>alert(1)</script>' }, customFields: { localización: 'línea 1\nlínea 2', hidden: 'not shown' },
};

describe('ImportedHistorySection', () => {
  it('shows separate imported provenance and safely renders text', () => {
    render(<ImportedHistorySection items={[event]} hasMore={false} onLoadMore={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Imported history' })).toBeInTheDocument();
    expect(screen.getByText(/Rows 21–22 \(merged block\)/)).toBeInTheDocument();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/línea 1/)).toBeInTheDocument();
  });

  it('loads the next imported page without changing native content', () => {
    const onLoadMore = vi.fn();
    render(<ImportedHistorySection items={[event]} hasMore onLoadMore={onLoadMore} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load more imported history' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

const useFieldCatalog = vi.hoisted(() => vi.fn());
const useExecuteAdHoc = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useResearchV2', () => ({ useFieldCatalog, useExecuteAdHoc }));

import { FilterBuilderV2 } from './FilterBuilderV2';
import { renderWithProviders } from '../../../../test/query-test-utils';

describe('FilterBuilderV2', () => {
  beforeEach(() => {
    useFieldCatalog.mockReset();
    useExecuteAdHoc.mockReset();
  });

  function makeAdhoc(result: { totalRows: number; rows?: any[] } = { totalRows: 42, rows: [] }) {
    const mutation = vi.fn(async (): Promise<{ totalRows: number; rows?: any[] }> => result);
    return {
      mutateAsync: mutation,
      isPending: false,
      isError: false,
      mutate: mutation,
      reset: vi.fn(),
    } as any;
  }

  it('lets the user add a filter row and toggle logic', () => {
    useFieldCatalog.mockReturnValue({ data: { entries: [] }, isLoading: false });
    useExecuteAdHoc.mockReturnValue(makeAdhoc());
    const onChange = vi.fn();
    renderWithProviders(<FilterBuilderV2 filters={[]} logic="AND" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Añadir filtro' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ source: 'standard', operator: 'equals' })]),
      'AND',
    );
  });

  it('fires the debounced live-preview ad-hoc query after edits', async () => {
    const adhoc = makeAdhoc({ totalRows: 7, rows: [] });
    useFieldCatalog.mockReturnValue({ data: { entries: [] }, isLoading: false });
    useExecuteAdHoc.mockReturnValue(adhoc);
    const onChange = vi.fn();
    renderWithProviders(
      <FilterBuilderV2
        filters={[{ field: 'age', source: 'standard', operator: 'greater_than', value: '50' }]}
        logic="AND"
        onChange={onChange}
        debounceMs={0}
      />,
    );

    await waitFor(() => expect(adhoc.mutateAsync).toHaveBeenCalled());
    const call = (adhoc.mutateAsync as any).mock.calls[0][0];
    expect(call.filters).toHaveLength(1);
    expect(call.filters[0].field).toBe('age');
    expect(call.limit).toBe(5);
  });

  it('renders the live-preview count once results arrive', async () => {
    const adhoc = makeAdhoc({
      totalRows: 123,
      rows: [{ patientId: 'p1', nhc: '0001', fields: { age: 45 } }],
    });
    useFieldCatalog.mockReturnValue({ data: { entries: [] }, isLoading: false });
    useExecuteAdHoc.mockReturnValue(adhoc);
    renderWithProviders(
      <FilterBuilderV2
        filters={[{ field: 'age', source: 'standard', operator: 'greater_than', value: '50' }]}
        logic="AND"
        onChange={vi.fn()}
        debounceMs={0}
      />,
    );

    await waitFor(() => expect(screen.getByText('123 pacientes')).toBeInTheDocument());
  });
});
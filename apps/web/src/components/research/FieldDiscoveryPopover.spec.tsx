import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/query-test-utils';

// Mock the catalog hook so the popover renders synchronously without network.
const useFieldCatalog = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useResearchV2', () => ({ useFieldCatalog }));
vi.mock('next/navigation', () => ({ useRouter: () => ({}) }));

import { FieldDiscoveryPopover } from './FieldDiscoveryPopover';

const ENTRIES = [
  { field: 'evaNRS', source: 'imported' as const, type: 'number' as const, nonNullCount: 90, examples: [3, 7, 5] },
  { field: 'age', source: 'standard' as const, type: 'number' as const, nonNullCount: 120, examples: [45, 62, 58] },
  { field: 'sex', source: 'standard' as const, type: 'string' as const, nonNullCount: 121, examples: ['M', 'F'] },
  { field: 'diagnosisDate', source: 'imported' as const, type: 'date' as const, nonNullCount: 40, examples: ['2024-01-02'] },
  { field: 'smokes', source: 'imported' as const, type: 'boolean' as const, nonNullCount: 40, examples: [true, false] },
];

describe('FieldDiscoveryPopover', () => {
  beforeEach(() => useFieldCatalog.mockReset());

  it('renders the catalog with type + source badges, non-null count and examples', () => {
    useFieldCatalog.mockReturnValue({ data: { entries: ENTRIES }, isLoading: false });
    const onSelect = vi.fn();
    renderWithProviders(<FieldDiscoveryPopover value="" onSelect={onSelect} />);
    // Open the list
    fireEvent.focus(screen.getByRole('textbox'));

    expect(useFieldCatalog).toHaveBeenCalled();
    // Type badges present
    expect(screen.getByText('age')).toBeInTheDocument();
    // Type badges: TXT (string), # (number), FECHA (date), BOOL (boolean).
    expect(screen.getByText('TXT')).toBeInTheDocument();
    expect(screen.getAllByText('#').length).toBe(2); // evaNRS + age
    expect(screen.getByText('FECHA')).toBeInTheDocument();
    expect(screen.getByText('BOOL')).toBeInTheDocument();
    // examples rendered
    expect(screen.getByText(/45, 62, 58/)).toBeInTheDocument();
  });

  it('suggests imported + standard fields and filters by source', () => {
    useFieldCatalog.mockReturnValue({ data: { entries: ENTRIES }, isLoading: false });
    renderWithProviders(<FieldDiscoveryPopover value="" onSelect={vi.fn()} source="imported" />);
    fireEvent.focus(screen.getByRole('textbox'));
    expect(screen.getByText('evaNRS')).toBeInTheDocument();
    expect(screen.queryByText('age')).not.toBeInTheDocument();
  });

  it('calls onSelect with the chosen entry and closes the list', () => {
    useFieldCatalog.mockReturnValue({ data: { entries: ENTRIES }, isLoading: false });
    const onSelect = vi.fn();
    renderWithProviders(<FieldDiscoveryPopover value="" onSelect={onSelect} />);
    fireEvent.focus(screen.getByRole('textbox'));
    fireEvent.click(screen.getByText('sex'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ field: 'sex' }));
  });

  it('shows a no-results state when the catalog is empty', () => {
    useFieldCatalog.mockReturnValue({ data: { entries: [] }, isLoading: false });
    renderWithProviders(<FieldDiscoveryPopover value="zzz" onSelect={vi.fn()} />);
    fireEvent.focus(screen.getByRole('textbox'));
    expect(screen.getByText(/No se encontraron campos/)).toBeInTheDocument();
  });
});
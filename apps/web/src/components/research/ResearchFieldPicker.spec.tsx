import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/query-test-utils';

const useFieldCatalog = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useResearchV2', () => ({ useFieldCatalog }));

import { ResearchFieldPicker } from './ResearchFieldPicker';

const ENTRIES = [
  { field: 'age', source: 'standard' as const, type: 'number' as const, nonNullCount: 120, examples: [45] },
  { field: 'sex', source: 'standard' as const, type: 'string' as const, nonNullCount: 121, examples: ['F'] },
  { field: 'birthDate', source: 'standard' as const, type: 'date' as const, nonNullCount: 100, examples: ['1980-01-01'] },
  { field: 'bloodType', source: 'standard' as const, type: 'string' as const, nonNullCount: 80, examples: ['A+'] },
  { field: 'nhc', source: 'standard' as const, type: 'string' as const, nonNullCount: 123, examples: ['NHC-1'] },
  { field: 'importSource', source: 'standard' as const, type: 'string' as const, nonNullCount: 90, examples: ['legacy'] },
  { field: 'createdAt', source: 'standard' as const, type: 'date' as const, nonNullCount: 123, examples: ['2024-01-01'] },
  { field: 'diagnosisCode', source: 'imported' as const, type: 'string' as const, nonNullCount: 70, examples: ['J34.2'] },
  { field: 'diagnosisDate', source: 'imported' as const, type: 'date' as const, nonNullCount: 60, examples: ['2024-01-02'] },
  { field: 'procedureType', source: 'imported' as const, type: 'string' as const, nonNullCount: 50, examples: ['Septoplasty'] },
];

describe('ResearchFieldPicker', () => {
  beforeEach(() => {
    useFieldCatalog.mockReset();
    useFieldCatalog.mockReturnValue({ data: { entries: ENTRIES }, isLoading: false });
  });

  it('shows clinical presets and adds only fields that exist and are not selected', () => {
    const onChange = vi.fn();
    renderWithProviders(<ResearchFieldPicker value={['age']} onChange={onChange} />);

    fireEvent.focus(screen.getByRole('textbox', { name: 'Añadir campo' }));

    expect(screen.getByText('Sugerencias para empezar')).toBeInTheDocument();
    expect(screen.getAllByText('Edad').length).toBeGreaterThan(0);
    expect(screen.getAllByText('age').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Añadir Perfil del paciente \(3 campos\)/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Añadir Perfil del paciente \(3 campos\)/ }));
    expect(onChange).toHaveBeenCalledWith(['age', 'sex', 'birthDate', 'bloodType']);
  });

  it('shows completeness, type, source and detected clinical categories', () => {
    renderWithProviders(<ResearchFieldPicker value={[]} onChange={vi.fn()} />);

    fireEvent.focus(screen.getByRole('textbox', { name: 'Añadir campo' }));

    expect(screen.getAllByText(/numérico/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/120 no nulos/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('importado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Diagnósticos').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Añadir Diagnósticos \(2 campos\)/ })).toBeInTheDocument();
  });

  it('shows a percentage only when the patient total is explicitly available', () => {
    renderWithProviders(<ResearchFieldPicker value={[]} onChange={vi.fn()} totalPatients={200} />);

    fireEvent.focus(screen.getByRole('textbox', { name: 'Añadir campo' }));

    expect(screen.getAllByText(/60% completos/).length).toBeGreaterThan(0);
  });

  it('supports quick intent selection without changing the API contract', () => {
    const onChange = vi.fn();
    renderWithProviders(<ResearchFieldPicker value={[]} onChange={onChange} />);

    fireEvent.focus(screen.getByRole('textbox', { name: 'Añadir campo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Usar intención Datos de cirugía' }));

    expect(onChange).toHaveBeenCalledWith(['procedureType']);
  });

  it('removes a selected field through its clinical chip action', () => {
    const onChange = vi.fn();
    renderWithProviders(<ResearchFieldPicker value={['age', 'sex']} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Quitar campo Edad' }));
    expect(onChange).toHaveBeenCalledWith(['sex']);
  });

  it('renders a clear empty-catalog state without suggestions', () => {
    useFieldCatalog.mockReturnValue({ data: { entries: [] }, isLoading: false });
    renderWithProviders(<ResearchFieldPicker value={[]} onChange={vi.fn()} />);

    fireEvent.focus(screen.getByRole('textbox', { name: 'Añadir campo' }));

    expect(screen.getByText('Sugerencias para empezar')).toBeInTheDocument();
    expect(screen.getByText('No hay campos disponibles para sugerir.')).toBeInTheDocument();
    expect(screen.getByText('No se encontraron campos.')).toBeInTheDocument();
  });

  it('shows backend labels, completeness and provenance in suggestions', () => {
    useFieldCatalog.mockReturnValue({
      data: {
        totalPatients: 100,
        entries: [{
          field: 'EVA clínica',
          label: 'Dolor percibido',
          unit: 'puntos',
          source: 'imported' as const,
          type: 'number' as const,
          nonNullCount: 80,
          totalCount: 100,
          completenessPercent: 80,
          examples: [8],
          originalHeaders: ['EVA clínica'],
          batches: [{
            id: 'batch-1',
            fileName: 'seguimiento.xlsx',
            originalFormat: 'xlsx',
            importedAt: '2026-08-01T10:00:00.000Z',
          }],
        }],
      },
      isLoading: false,
    });
    renderWithProviders(<ResearchFieldPicker value={[]} onChange={vi.fn()} />);
    fireEvent.focus(screen.getByRole('textbox', { name: 'Añadir campo' }));

    expect(screen.getAllByText('Dolor percibido').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/EVA clínica/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/80\/100 \(80%\).*unidad: puntos/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Excel: EVA clínica/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Lote: seguimiento\.xlsx \(xlsx\)/).length).toBeGreaterThan(0);
  });
});

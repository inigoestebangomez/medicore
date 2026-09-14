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
    expect(screen.getByRole('heading', { name: 'Historial importado' })).toBeInTheDocument();
    expect(screen.getByText(/Filas 21–22 \(bloque agrupado\)/)).toBeInTheDocument();
    expect(screen.getByText('Diagnóstico:')).toBeInTheDocument();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/línea 1/)).toBeInTheDocument();
    expect(screen.getByText('not shown')).toBeInTheDocument();
    expect(screen.getByText(/también se generan consultas o cirugías nativas/)).toBeInTheDocument();
  });

  it('loads the next imported page without changing native content', () => {
    const onLoadMore = vi.fn();
    render(<ImportedHistorySection items={[event]} hasMore onLoadMore={onLoadMore} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más historial importado' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('renders estimated birth-date provenance with Spanish labels', () => {
    const estimatedEvent = {
      ...event,
      id: 'batch-1-23-0',
      standardFields: { birthDate: '1976-01-01', birthDateEstimated: true, birthDateReferenceYear: 2026 },
      customFields: {},
    };
    render(<ImportedHistorySection items={[estimatedEvent]} hasMore={false} onLoadMore={() => undefined} />);

    expect(screen.getByText('Fecha de nacimiento estimada:')).toBeInTheDocument();
    expect(screen.getByText('Año de referencia de la edad:')).toBeInTheDocument();
  });

  it('renders duration provenance with Spanish labels', () => {
    const durationEvent = {
      ...event,
      standardFields: { hospitalStayDays: 3, surgeryDurationMinutes: 138 },
      customFields: {},
    };
    render(<ImportedHistorySection items={[durationEvent]} hasMore={false} onLoadMore={() => undefined} />);

    expect(screen.getByText('Tiempo de hospitalización (días):')).toBeInTheDocument();
    expect(screen.getByText('Tiempo quirúrgico (minutos):')).toBeInTheDocument();
  });

  it('renders consultation and surgery provenance with Spanish labels', () => {
    const clinicalEvent = {
      ...event,
      standardFields: {
        consultationDate: '2026-01-01', chiefComplaint: 'Dolor', diagnosisCodes: 'R51 pendiente',
        surgeryDate: '2026-01-02', asa: 'ASA_II', technique: 'Endoscópica', postOpNotes: 'Buena evolución',
      },
      customFields: {},
    };
    render(<ImportedHistorySection items={[clinicalEvent]} hasMore={false} onLoadMore={() => undefined} />);

    expect(screen.getByText('Fecha de consulta:')).toBeInTheDocument();
    expect(screen.getByText('Motivo de consulta:')).toBeInTheDocument();
    expect(screen.getByText('Códigos diagnósticos:')).toBeInTheDocument();
    expect(screen.getByText('Fecha de cirugía:')).toBeInTheDocument();
    expect(screen.getByText('Clasificación ASA:')).toBeInTheDocument();
    expect(screen.getByText('Técnica quirúrgica:')).toBeInTheDocument();
    expect(screen.getByText('Notas postoperatorias:')).toBeInTheDocument();
  });
});

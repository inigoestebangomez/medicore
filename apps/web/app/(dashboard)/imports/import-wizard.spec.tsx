import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatImportPreviewValue, ImportWizard } from './import-wizard';

const mocks = vi.hoisted(() => ({
  parse: vi.fn(),
  reanalyze: vi.fn(),
  confirm: vi.fn(),
  finalize: vi.fn(),
  detail: vi.fn(),
  preview: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/hooks/useImports', () => ({
  useParseImportFile: () => ({ mutateAsync: mocks.parse, isPending: false }),
  useReanalyzeImport: () => ({ mutateAsync: mocks.reanalyze, isPending: false }),
  useConfirmImportMapping: () => ({ mutateAsync: mocks.confirm, isPending: false }),
   useFinalizeImport: () => ({ mutateAsync: mocks.finalize, isPending: false }),
   useImportBatch: () => mocks.detail(),
   useImportPreview: (...args: unknown[]) => mocks.preview(...args),
 }));

const parsed = {
  batchId: 'batch-1',
  fileName: 'pacientes.xlsx',
  originalFormat: 'xlsx' as const,
  totalRows: 6,
  fileHash: 'hash',
  sample: {
    columns: ['NHC', 'Nombre', 'Notas'],
      rows: [
        { NHC: '123456', Nombre: 'Ana', Notas: 'draft' },
        { NHC: '123457', Nombre: 'Paciente 2', Notas: 'ok' },
        { NHC: '123458', Nombre: 'Paciente 3', Notas: 'ok' },
        { NHC: '123459', Nombre: 'Paciente 4', Notas: 'ok' },
        { NHC: '123460', Nombre: 'Paciente 5', Notas: 'ok' },
        { NHC: '', Nombre: '', Notas: 'pending' },
    ],
  },
  proposal: {
    columnMapping: { NHC: 'nhc' as const, Nombre: 'patientName' as const, Notas: 'custom' as const },
    customFieldNames: {},
    junkRowIndices: [],
    issues: [],
    confidence: 0.9,
    notes: '',
  },
  provider: 'heuristic',
};

describe('ImportWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parse.mockResolvedValue(parsed);
    mocks.confirm.mockResolvedValue({
      batchId: 'batch-1',
       totalRows: 6,
       cleanedRowCount: 5,
      junkRowCount: 0,
      skippedRowCount: 1,
      matches: [{ rowIndex: 0, candidateId: 'patient-1', score: 60, decision: 'confirm', reason: 'nombre completo exacto' }],
       pendingResolutionCount: 2,
      autoMatchCount: 0,
      newPatientCount: 0,
      fullIdentityRows: [{ rowIndex: 0 }],
      identityLightRows: [],
       unidentifiableRows: [{ rowIndex: 5, reason: 'pending_decision' }],
      fullIdentityCount: 1,
      identityLightCount: 0,
       unidentifiableCount: 1,
     });
    mocks.detail.mockReturnValue({ data: null });
    mocks.preview.mockReturnValue({ data: undefined, isPending: false, error: null });
  });

  describe('Excel date preview formatting', () => {
    it('formats numeric and string serials with the cleaner semantics', () => {
      expect(formatImportPreviewValue(45785, 'birthDate')).toBe('08/05/2025');
      expect(formatImportPreviewValue(46170, 'admissionDate')).toBe('28/05/2026');
      expect(formatImportPreviewValue('45785', 'requestDate')).toBe('08/05/2025');
    });

    it('formats explicit dates as dd/MM/yyyy and validates the calendar', () => {
      expect(formatImportPreviewValue('27/3/25', 'birthDate')).toBe('27/03/2025');
      expect(formatImportPreviewValue('05.03.68', 'admissionDate')).toBe('05/03/1968');
      expect(formatImportPreviewValue('2025-03-27', 'requestDate')).toBe('27/03/2025');
      expect(formatImportPreviewValue('31/02/2025', 'completionDate')).toBe('31/02/2025');
    });

    it('leaves non-serial text and the fake serial 60 unchanged', () => {
      expect(formatImportPreviewValue('Stand by, telemática 12/2026', 'completionDate')).toBe(
        'Stand by, telemática 12/2026',
      );
      expect(formatImportPreviewValue(60, 'birthDate')).toBe('60');
      expect(formatImportPreviewValue('60', 'birthDate')).toBe('60');
    });

    it('does not format numeric values outside date-mapped columns', () => {
      expect(formatImportPreviewValue(45785, 'nhc')).toBe('45785');
      expect(formatImportPreviewValue(50, 'age')).toBe('50');
      expect(formatImportPreviewValue(46170, 'custom')).toBe('46170');
      expect(formatImportPreviewValue(46170, 'ignore')).toBe('46170');
    });
  });

  it('uses formatted dates in the mapping example and paginated preview while preserving precedence', async () => {
    const dateParsed = {
      ...parsed,
      totalRows: 2,
      sample: {
        columns: ['Nacimiento', 'Ingreso', 'NHC', 'Edad', 'Notas'],
        rows: [
          { Nacimiento: 45785, Ingreso: 46170, NHC: 123456, Edad: 50, Notas: 46170 },
          { Nacimiento: '45785', Ingreso: 'Stand by, telemática 12/2026', NHC: 789012, Edad: 42, Notas: 45785 },
        ],
      },
      proposal: {
        ...parsed.proposal,
        columnMapping: {
          Nacimiento: 'birthDate' as const,
          Ingreso: 'admissionDate' as const,
          NHC: 'nhc' as const,
          Edad: 'age' as const,
          Notas: 'custom' as const,
        },
      },
    };
    mocks.parse.mockResolvedValue(dateParsed);
    mocks.preview.mockReturnValue({
      data: {
        batchId: 'batch-1',
        columns: dateParsed.sample.columns,
        rows: [
          { rowIndex: 0, values: dateParsed.sample.rows[0] },
          { rowIndex: 1, values: dateParsed.sample.rows[1] },
        ],
        totalRows: 2,
        page: 1,
        pageSize: 50,
        source: 'persisted',
      },
      isPending: false,
      error: null,
    });

    render(<ImportWizard />);
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['data'], 'patients.xlsx')] },
    });
    await waitFor(() => expect(screen.getByText('Revisar mapeo de columnas')).toBeInTheDocument());

    expect(screen.getByText('08/05/2025')).toBeInTheDocument();
    expect(screen.getByLabelText('Fila 1, Nacimiento')).toHaveValue('08/05/2025');
    expect(screen.getByLabelText('Fila 1, Ingreso')).toHaveValue('28/05/2026');
    expect(screen.getByLabelText('Fila 1, NHC')).toHaveValue('123456');
    expect(screen.getByLabelText('Fila 1, Edad')).toHaveValue('50');
    expect(screen.getByLabelText('Fila 1, Notas')).toHaveValue('46170');
    expect(screen.getByLabelText('Fila 2, Nacimiento')).toHaveValue('08/05/2025');
    expect(screen.getByLabelText('Fila 2, Ingreso')).toHaveValue('Stand by, telemática 12/2026');

    fireEvent.change(screen.getByLabelText('Fila 1, Nacimiento'), { target: { value: '27/3/25' } });
    expect(screen.getByLabelText('Fila 1, Nacimiento')).toHaveValue('27/3/25');
    fireEvent.click(screen.getByRole('button', { name: 'Descartar Fila 1, Nacimiento' }));
    expect(screen.getByLabelText('Fila 1, Nacimiento')).toHaveValue('');
  });

  it('proposes Nombre and Nº Paciente as separate identity fields', async () => {
    const identityParsed = {
      ...parsed,
      sample: {
        columns: ['Nombre', 'Nº Paciente'],
        rows: [{ Nombre: 'Ana', 'Nº Paciente': '123456' }],
      },
      proposal: {
        ...parsed.proposal,
        columnMapping: { Nombre: 'patientName' as const, 'Nº Paciente': 'nhc' as const },
      },
    };
    mocks.parse.mockResolvedValue(identityParsed);

    render(<ImportWizard />);
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['data'], 'patients.xlsx')] },
    });
    await waitFor(() => expect(screen.getByText('Revisar mapeo de columnas')).toBeInTheDocument());

    expect(screen.getAllByRole('combobox')[0]).toHaveValue('patientName');
    expect(screen.getAllByRole('combobox')[1]).toHaveValue('nhc');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar mapeo' })).not.toBeDisabled();
  });

  it('blocks confirmation until duplicate identity columns are remapped', async () => {
    const conflictingParsed = {
      ...parsed,
      sample: {
        columns: ['Nombre', 'Nº Paciente'],
        rows: [{ Nombre: 'Ana', 'Nº Paciente': '123456' }],
      },
      proposal: {
        ...parsed.proposal,
        columnMapping: { Nombre: 'patientName' as const, 'Nº Paciente': 'patientName' as const },
      },
    };
    mocks.parse.mockResolvedValue(conflictingParsed);

    render(<ImportWizard />);
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['data'], 'patients.xlsx')] },
    });
    await waitFor(() => expect(screen.getByText('Revisar mapeo de columnas')).toBeInTheDocument());

    expect(screen.getByRole('alert')).toHaveTextContent('Nombre');
    expect(screen.getByRole('alert')).toHaveTextContent('Nº Paciente');
    expect(screen.getByRole('button', { name: 'Resuelve los conflictos' })).toBeDisabled();

    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'custom' } });
    expect(screen.getByRole('button', { name: 'Confirmar mapeo' })).not.toBeDisabled();
  });

   it('stages preview edits beyond the first five rows, records column discard, and blocks finalize', async () => {
    render(<ImportWizard />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['data'], 'patients.xlsx')] } });
    await waitFor(() => expect(screen.getByText('Revisar mapeo de columnas')).toBeInTheDocument());

     fireEvent.change(screen.getByLabelText('Fila 6, Nombre'), { target: { value: 'Paciente pendiente' } });
    expect(screen.getAllByRole('combobox')[0]).toHaveClass('bg-surface-lowest', 'text-on-surface');
    expect(screen.getByLabelText('Fila 1, Nombre')).toHaveClass('bg-surface-lowest', 'text-on-surface');
    expect(screen.getAllByRole('button', { name: 'Descartar columna' })[0]).toHaveClass('border-outline-variant');
    fireEvent.click(screen.getAllByRole('button', { name: 'Descartar columna' })[2]);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar mapeo' }));

     await waitFor(() => expect(screen.getByText('Resolver cruces de pacientes')).toBeInTheDocument());
     expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({
       previewOverrides: { '5': { Nombre: 'Paciente pendiente' } },
       ignoredColumns: [{ column: 'Notas', reason: '' }],
     }));
     expect(screen.getByRole('button', { name: 'Resuelve las filas pendientes' })).toBeDisabled();
   });

    it('preserves a row override when returning to mapping and reclassifies the row', async () => {
     const pending = {
       batchId: 'batch-1',
       totalRows: 6,
       cleanedRowCount: 5,
       junkRowCount: 0,
       skippedRowCount: 1,
       matches: [],
       pendingResolutionCount: 1,
       autoMatchCount: 0,
       newPatientCount: 0,
       fullIdentityRows: [],
       identityLightRows: [],
       unidentifiableRows: [{ rowIndex: 5, reason: 'pending_decision' }],
       fullIdentityCount: 0,
       identityLightCount: 0,
       unidentifiableCount: 1,
     };
     const resolved = {
       ...pending,
       cleanedRowCount: 6,
       skippedRowCount: 0,
       pendingResolutionCount: 0,
       fullIdentityRows: [{ rowIndex: 5 }],
       fullIdentityCount: 1,
       unidentifiableRows: [],
       unidentifiableCount: 0,
     };
     mocks.confirm.mockResolvedValueOnce(pending).mockResolvedValueOnce(resolved);

     render(<ImportWizard />);
     const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
     fireEvent.change(fileInput, { target: { files: [new File(['data'], 'patients.xlsx')] } });
     await waitFor(() => expect(screen.getByText('Revisar mapeo de columnas')).toBeInTheDocument());

     fireEvent.click(screen.getByRole('button', { name: 'Confirmar mapeo' }));
     await waitFor(() => expect(screen.getByText('Resolver cruces de pacientes')).toBeInTheDocument());
     fireEvent.click(screen.getByRole('tab', { name: /Sin identificar/ }));
     expect(screen.getByText('Contenido disponible de la fila')).toBeInTheDocument();
     expect(screen.getByText('pending')).toBeInTheDocument();

     fireEvent.click(screen.getByRole('button', { name: 'Volver al mapeo' }));
     expect(screen.getByLabelText('Fila 6, Nombre')).toHaveValue('');
     fireEvent.change(screen.getByLabelText('Fila 6, Nombre'), { target: { value: 'Fila corregida' } });
     fireEvent.click(screen.getByRole('button', { name: 'Confirmar mapeo' }));

     await waitFor(() => expect(screen.getByText(/0 por revisar/)).toBeInTheDocument());
     expect(mocks.confirm).toHaveBeenLastCalledWith(expect.objectContaining({
       previewOverrides: { '5': { Nombre: 'Fila corregida' } },
     }));
     expect(screen.getByRole('button', { name: 'Finalizar importación' })).not.toBeDisabled();
     });

    it('makes a row discard explicit, reversible, and part of the confirm payload', async () => {
      mocks.confirm.mockResolvedValue({
        batchId: 'batch-1', totalRows: 6, cleanedRowCount: 5, junkRowCount: 0, skippedRowCount: 0,
        discardedRowCount: 1, matches: [], pendingResolutionCount: 0, autoMatchCount: 0, newPatientCount: 5,
        fullIdentityRows: [{ rowIndex: 1 }], identityLightRows: [], unidentifiableRows: [],
        fullIdentityCount: 1, identityLightCount: 0, unidentifiableCount: 0,
      });
      render(<ImportWizard />);
      fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
        target: { files: [new File(['data'], 'patients.xlsx')] },
      });
      await waitFor(() => expect(screen.getByText('Revisar mapeo de columnas')).toBeInTheDocument());

      fireEvent.click(screen.getAllByRole('button', { name: 'Descartar fila' })[1]);
      expect(screen.getByRole('button', { name: 'Restaurar fila' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Restaurar fila' }));
      fireEvent.click(screen.getAllByRole('button', { name: 'Descartar fila' })[1]);
      fireEvent.change(screen.getByLabelText('Motivo fila 2'), { target: { value: 'registro administrativo' } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar mapeo' }));

      await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({
        ignoredRows: [{ rowIndex: 1, reason: 'registro administrativo' }],
      })));
    });

    it('pages the complete preview and stages the real row index from a later page', async () => {
      const rows = Array.from({ length: 1047 }, (_, rowIndex) => ({
        rowIndex,
        values: { NHC: String(rowIndex), Nombre: `Paciente ${rowIndex}` },
      }));
      mocks.preview.mockImplementation((_batchId: string, page: number) => ({
        data: {
          batchId: 'batch-1', columns: ['NHC', 'Nombre'], rows: rows.slice((page - 1) * 50, page * 50),
          totalRows: 1047, page, pageSize: 50, source: 'persisted',
        },
        isPending: false,
        error: null,
      }));
      mocks.confirm.mockResolvedValue({
        batchId: 'batch-1', totalRows: 1047, cleanedRowCount: 1047, junkRowCount: 0, skippedRowCount: 0,
        discardedRowCount: 0, matches: [], pendingResolutionCount: 0, autoMatchCount: 0, newPatientCount: 1047,
        fullIdentityRows: [{ rowIndex: 1046 }], identityLightRows: [], unidentifiableRows: [],
        fullIdentityCount: 1, identityLightCount: 0, unidentifiableCount: 0,
      });

      render(<ImportWizard />);
      fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
        target: { files: [new File(['data'], 'patients.xlsx')] },
      });
      await waitFor(() => expect(screen.getByText('Revisar mapeo de columnas')).toBeInTheDocument());
      for (let page = 2; page <= 21; page++) {
        fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
        await waitFor(() => expect(screen.getByText(new RegExp(`página ${page} de 21`))).toBeInTheDocument());
      }
      await waitFor(() => expect(screen.getByLabelText('Fila 1047, Nombre')).toHaveValue('Paciente 1046'));
      fireEvent.change(screen.getByLabelText('Fila 1047, Nombre'), { target: { value: 'Corregida al final' } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar mapeo' }));

      await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({
        previewOverrides: { '1046': { Nombre: 'Corregida al final' } },
      })));
      expect(screen.queryByLabelText('Fila 1, Nombre')).not.toBeInTheDocument();
    });

    it('resumes a confirming batch with its mapping and overrides', async () => {
      mocks.detail.mockReturnValue({
        data: {
          id: 'confirming-1', fileName: 'pendiente.csv', originalFormat: 'csv', totalRows: 1,
          status: 'CONFIRMING', errorMessage: null, importedRows: 0, enrichedRows: 0, createdRows: 0,
          skippedRows: 0, pendingRows: 0, createdAt: '2026-08-11T08:00:00.000Z', completedAt: null,
          sample: { columns: ['NHC', 'Nombre'], rows: [{ NHC: '1', Nombre: 'Ana' }] },
          columnMapping: { NHC: 'nhc', Nombre: 'patientName' },
          previewOverrides: { '0': { Nombre: 'Ana corregida' } },
          ignoredColumns: [], ignoredRows: [], cellOverrides: {},
        },
        isError: false,
      });

      render(<ImportWizard resumeBatchId="confirming-1" />);
      await waitFor(() => expect(screen.getByText('Revisar mapeo de columnas')).toBeInTheDocument());
      expect(screen.getByLabelText('Fila 1, Nombre')).toHaveValue('Ana corregida');
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar mapeo' }));
      await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({
        batchId: 'confirming-1', previewOverrides: { '0': { Nombre: 'Ana corregida' } },
      })));
    });

    it('explains how to recover when a resumed batch has no persisted rows', async () => {
      mocks.detail.mockReturnValue({
        data: {
          id: 'old-1', fileName: 'antiguo.csv', originalFormat: 'csv', totalRows: 1,
          status: 'CONFIRMING', errorMessage: null, importedRows: 0, enrichedRows: 0, createdRows: 0,
          skippedRows: 0, pendingRows: 0, createdAt: '2026-08-11T08:00:00.000Z', completedAt: null,
          sample: { columns: ['NHC'], rows: [{ NHC: '1' }] }, columnMapping: { NHC: 'nhc' },
        }, isError: false,
      });
      mocks.preview.mockReturnValue({ data: undefined, isPending: false, error: new Error('not found') });

      render(<ImportWizard resumeBatchId="old-1" />);
      await waitFor(() => expect(screen.getByText(/Vuelve a subir el archivo para continuar/)).toBeInTheDocument());
      expect(screen.getByText('Revisar mapeo de columnas')).toBeInTheDocument();
    });

    it('does not show success immediately after PROCESSING', async () => {
      mocks.confirm.mockResolvedValue({
        batchId: 'batch-1', totalRows: 6, cleanedRowCount: 6, junkRowCount: 0, skippedRowCount: 0,
        matches: [], pendingResolutionCount: 0, autoMatchCount: 0, newPatientCount: 0,
        fullIdentityRows: [{ rowIndex: 0 }], identityLightRows: [], unidentifiableRows: [],
        fullIdentityCount: 1, identityLightCount: 0, unidentifiableCount: 0,
      });
      mocks.finalize.mockResolvedValue({ batchId: 'batch-1', status: 'PROCESSING', message: 'queued' });
      mocks.detail.mockReturnValue({ data: { status: 'PROCESSING', errorMessage: null } });

      render(<ImportWizard />);
      fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
        target: { files: [new File(['data'], 'patients.xlsx')] },
      });
      await waitFor(() => expect(screen.getByText('Revisar mapeo de columnas')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar mapeo' }));
      await waitFor(() => expect(screen.getByText('Resolver cruces de pacientes')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Finalizar importación' }));

      await waitFor(() => expect(screen.getByText('Importación en proceso')).toBeInTheDocument());
      expect(screen.queryByText('Importación completada')).not.toBeInTheDocument();
    });

    it('returns to matches and renders the detail error on PROCESSING to FAILED', async () => {
      mocks.confirm.mockResolvedValue({
        batchId: 'batch-1', totalRows: 6, cleanedRowCount: 6, junkRowCount: 0, skippedRowCount: 0,
        matches: [], pendingResolutionCount: 0, autoMatchCount: 0, newPatientCount: 0,
        fullIdentityRows: [{ rowIndex: 0 }], identityLightRows: [], unidentifiableRows: [],
        fullIdentityCount: 1, identityLightCount: 0, unidentifiableCount: 0,
      });
      mocks.finalize.mockResolvedValue({ batchId: 'batch-1', status: 'PROCESSING', message: 'queued' });
      mocks.detail.mockReturnValue({ data: { status: 'FAILED', errorMessage: 'NHC requiere resolución manual' } });

      render(<ImportWizard />);
      fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
        target: { files: [new File(['data'], 'patients.xlsx')] },
      });
      await waitFor(() => expect(screen.getByText('Revisar mapeo de columnas')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar mapeo' }));
      await waitFor(() => expect(screen.getByText('Resolver cruces de pacientes')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Finalizar importación' }));

      await waitFor(() => expect(screen.getByText('NHC requiere resolución manual')).toBeInTheDocument());
      expect(screen.getByText('Resolver cruces de pacientes')).toBeInTheDocument();
    });

    it('renders success only after the detail reports COMPLETED', async () => {
      mocks.confirm.mockResolvedValue({
        batchId: 'batch-1', totalRows: 6, cleanedRowCount: 6, junkRowCount: 0, skippedRowCount: 0,
        matches: [], pendingResolutionCount: 0, autoMatchCount: 0, newPatientCount: 0,
        fullIdentityRows: [{ rowIndex: 0 }], identityLightRows: [], unidentifiableRows: [],
        fullIdentityCount: 1, identityLightCount: 0, unidentifiableCount: 0,
      });
      mocks.finalize.mockResolvedValue({ batchId: 'batch-1', status: 'PROCESSING', message: 'queued' });
      mocks.detail.mockReturnValue({ data: { status: 'COMPLETED', errorMessage: null } });

      render(<ImportWizard />);
      fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
        target: { files: [new File(['data'], 'patients.xlsx')] },
      });
      await waitFor(() => expect(screen.getByText('Revisar mapeo de columnas')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar mapeo' }));
      await waitFor(() => expect(screen.getByText('Resolver cruces de pacientes')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Finalizar importación' }));

      await waitFor(() => expect(screen.getByText('Importación completada')).toBeInTheDocument());
    });
});

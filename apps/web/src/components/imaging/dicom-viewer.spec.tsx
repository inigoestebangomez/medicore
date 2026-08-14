import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DicomViewer, createDicomImageId } from './dicom-viewer';

const mocks = vi.hoisted(() => ({
  enable: vi.fn(),
  disable: vi.fn(),
  loadAndCacheImage: vi.fn(),
  displayImage: vi.fn(),
  resize: vi.fn(),
  initialize: vi.fn(),
  loader: {
    external: {} as { cornerstone?: unknown; dicomParser?: unknown },
    webWorkerManager: { initialize: vi.fn() },
  },
}));

vi.mock('cornerstone-core', () => ({
  default: {
    enable: mocks.enable,
    disable: mocks.disable,
    loadAndCacheImage: mocks.loadAndCacheImage,
    displayImage: mocks.displayImage,
    resize: mocks.resize,
  },
}));

vi.mock('cornerstone-wado-image-loader', () => ({ default: mocks.loader }));
vi.mock('dicom-parser', () => ({ default: { parseDicom: vi.fn() } }));

describe('DicomViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadAndCacheImage.mockResolvedValue({ imageId: 'wadouri:https://example.test/scan.dcm' });
  });

  it('builds a WADO-URI image id for a direct DICOM object URL', () => {
    expect(createDicomImageId(' https://example.test/scan.dcm ')).toBe('wadouri:https://example.test/scan.dcm');
    expect(createDicomImageId('')).toBeNull();
    expect(createDicomImageId('wadors:https://example.test/studies/1')).toBeNull();
  });

  it('initializes dependencies and renders a direct DICOM file', async () => {
    render(<DicomViewer fileUrl="https://example.test/scan.dcm" studyId="study-1" />);

    await waitFor(() => expect(mocks.displayImage).toHaveBeenCalledOnce());

    expect(mocks.loader.external.cornerstone).toBeDefined();
    expect(mocks.loader.external.dicomParser).toBeDefined();
    expect(mocks.loader.webWorkerManager.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ startWebWorkersOnDemand: true }),
    );
    expect(mocks.loadAndCacheImage).toHaveBeenCalledWith('wadouri:https://example.test/scan.dcm');
    expect(screen.getByText('Visor DICOM — Estudio study-1')).toBeInTheDocument();
  });

  it('shows an actionable fallback when the direct file URL is missing', async () => {
    render(<DicomViewer fileUrl="" studyId="study-2" />);

    await waitFor(() => expect(screen.getByText(/No hay una URL directa disponible/)).toBeInTheDocument());

    expect(mocks.loadAndCacheImage).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Descargar archivo DICOM' })).not.toBeInTheDocument();
  });

  it('does not present a download link for an unsupported WADO-RS image id', async () => {
    render(<DicomViewer fileUrl="wadors:https://example.test/studies/1" studyId="study-2b" />);

    await waitFor(() => expect(screen.getByText(/wadors: requiere metadata DICOMweb/)).toBeInTheDocument());

    expect(screen.queryByRole('link', { name: 'Descargar archivo DICOM' })).not.toBeInTheDocument();
  });

  it('shows a download fallback when decoding fails', async () => {
    mocks.loadAndCacheImage.mockRejectedValueOnce(new Error('invalid DICOM'));
    render(<DicomViewer fileUrl="https://example.test/bad.dcm" studyId="study-3" />);

    await waitFor(() => expect(screen.getByText(/No se pudo descargar o decodificar/)).toBeInTheDocument());

    expect(screen.getByRole('link', { name: 'Descargar archivo DICOM' })).toHaveAttribute(
      'href',
      'https://example.test/bad.dcm',
    );
  });
});

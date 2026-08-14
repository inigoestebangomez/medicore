'use client';

import { useEffect, useRef, useState } from 'react';

interface DicomViewerProps {
  fileUrl: string;
  studyId: string;
  onClose?: () => void;
}

interface CornerstoneRuntime {
  cornerstone: CornerstoneApi;
  loader: WadoImageLoaderApi;
}

let runtimePromise: Promise<CornerstoneRuntime> | null = null;

function unwrapDefault<T>(module: T | { default: T }): T {
  if (typeof module === 'object' && module !== null && 'default' in module) {
    return module.default;
  }
  return module as T;
}

function loadCornerstoneRuntime(): Promise<CornerstoneRuntime> {
  if (!runtimePromise) {
    runtimePromise = Promise.all([
      import('cornerstone-core'),
      import('cornerstone-wado-image-loader'),
      import('dicom-parser'),
    ]).then(([cornerstoneModule, loaderModule, dicomParserModule]) => {
      const cornerstone = unwrapDefault(cornerstoneModule);
      const loader = unwrapDefault(loaderModule);

      loader.external.cornerstone = cornerstone;
      loader.external.dicomParser = unwrapDefault(dicomParserModule);
      loader.webWorkerManager.initialize({
        maxWebWorkers: Math.max(1, Math.min(window.navigator.hardwareConcurrency || 1, 4)),
        startWebWorkersOnDemand: true,
        taskConfiguration: {
          decodeTask: {
            initializeCodecsOnStartup: false,
            strict: false,
          },
        },
      });

      return { cornerstone, loader };
    });
  }

  return runtimePromise;
}

export function createDicomImageId(fileUrl: string): string | null {
  const normalizedUrl = fileUrl.trim();
  if (!normalizedUrl || normalizedUrl.startsWith('wadors:')) return null;
  return `wadouri:${normalizedUrl}`;
}

function LoadingMessage() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      <span className="ml-3 text-sm text-on-surface-variant">Cargando visor DICOM...</span>
    </div>
  );
}

function ViewerFallback({ fileUrl, error, onClose }: Pick<DicomViewerProps, 'fileUrl' | 'onClose'> & { error: string }) {
  const canDownload = Boolean(fileUrl.trim()) && !fileUrl.trim().startsWith('wadors:');

  return (
    <div className="rounded border border-yellow-200 bg-yellow-50 p-6 text-center">
      <p className="text-sm text-yellow-800 font-medium">{error}</p>
      {canDownload && (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Descargar archivo DICOM
        </a>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="mt-2 block mx-auto text-sm text-on-surface-variant hover:text-on-surface-variant"
        >
          Cerrar
        </button>
      )}
    </div>
  );
}

export function DicomViewer({ fileUrl, studyId, onClose }: DicomViewerProps) {
  const [runtime, setRuntime] = useState<CornerstoneRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    loadCornerstoneRuntime()
      .then((loadedRuntime) => {
        if (!cancelled) setRuntime(loadedRuntime);
      })
      .catch(() => {
        if (cancelled) return;
        setError('No se pudo inicializar el visor DICOM. Descarga el archivo y ábrelo con un visor DICOM compatible.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!runtime || !elementRef.current) return;

    let cancelled = false;
    let enabled = false;
    const element = elementRef.current;
    const loadedRuntime = runtime;
    const imageId = createDicomImageId(fileUrl);

    setError(null);
    setLoading(true);

    if (!imageId) {
      setError(
        fileUrl.trim().startsWith('wadors:')
          ? 'wadors: requiere metadata DICOMweb y una URL de frame; este visor espera la URL directa de un archivo DICOM.'
          : 'No hay una URL directa disponible para el archivo DICOM. Solicita una URL de descarga al servidor.',
      );
      setLoading(false);
      return;
    }
    const loadedImageId = imageId;

    async function loadImage() {
      try {
        loadedRuntime.cornerstone.enable(element);
        enabled = true;
        const image = await loadedRuntime.cornerstone.loadAndCacheImage(loadedImageId);
        if (cancelled) return;
        loadedRuntime.cornerstone.displayImage(element, image);
        loadedRuntime.cornerstone.resize(element);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setError('No se pudo descargar o decodificar el archivo DICOM. Verifica que la URL siga vigente y que el archivo sea válido.');
        setLoading(false);
      }
    }

    void loadImage();

    return () => {
      cancelled = true;
      if (enabled) {
        try {
          loadedRuntime.cornerstone.disable(element);
        } catch {
          // Cornerstone may already have removed the enabled element.
        }
      }
    };
  }, [fileUrl, runtime]);

  if (error) return <ViewerFallback fileUrl={fileUrl} error={error} onClose={onClose} />;
  if (!runtime) return <LoadingMessage />;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-on-surface-variant">
          Visor DICOM — Estudio {studyId}
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-on-surface-variant hover:text-on-surface-variant"
            aria-label="Cerrar visor"
          >
            ✕
          </button>
        )}
      </div>
      <div className="relative">
        <div
          ref={elementRef}
          className="w-full h-96 bg-black rounded"
          style={{ minWidth: 300, minHeight: 300 }}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center rounded bg-black/70">
            <span className="text-sm text-white">Cargando imagen DICOM...</span>
          </div>
        )}
      </div>
    </div>
  );
}

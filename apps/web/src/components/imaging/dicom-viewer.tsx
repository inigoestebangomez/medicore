'use client';

// apps/web/src/components/imaging/dicom-viewer.tsx
// IMG-14: Lazy-loaded DICOM viewer with Cornerstone.js
// Gracefully degrades if cornerstone packages are not installed.

import React, { useEffect, useRef, useState } from 'react';

interface DicomViewerProps {
  fileUrl: string;
  studyId: string;
  onClose?: () => void;
}

// Sentinel: cached dynamic import result (cornerstone-core may not be installed)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cornerstoneCache: any = null;

/**
 * DicomViewer — renders DICOM files via Cornerstone.js.
 *
 * Since cornerstone-core and cornerstone-wado-image-loader are heavy
 * dependencies that may not be installed, this component uses dynamic
 * import with a graceful fallback.
 */
export function DicomViewer({ fileUrl, studyId, onClose }: DicomViewerProps) {
  const [cornerstoneReady, setCornerstoneReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const elementRef = useRef<HTMLDivElement>(null);

  // Phase 1: try to load cornerstone
  useEffect(() => {
    let cancelled = false;

    async function tryInit() {
      try {
        // Dynamic import — won't crash at build time; fails gracefully at runtime if missing
        // @ts-expect-error — cornerstone-core is an optional dependency
        const cs = await import('cornerstone-core');
        if (cancelled) return;

        cornerstoneCache = cs;
        setCornerstoneReady(true);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setError(
          'El visor DICOM requiere Cornerstone.js. Instalá cornerstone-core y cornerstone-wado-image-loader para habilitar la visualización DICOM.',
        );
        setLoading(false);
      }
    }

    tryInit();
    return () => { cancelled = true; };
  }, []);

  // Phase 2: render image when cornerstone + element are ready
  useEffect(() => {
    if (!cornerstoneReady || !elementRef.current || !cornerstoneCache) return;

    let cancelled = false;
    const element = elementRef.current;

    cornerstoneCache.enable(element);

    async function loadImage() {
      try {
        const imageId = `wadors:${fileUrl}`;
        const image = await cornerstoneCache!.loadAndCacheImage(imageId);
        if (cancelled) return;
        cornerstoneCache!.displayImage(element, image);
        cornerstoneCache!.resize(element);
      } catch {
        if (!cancelled) {
          setError('Error al cargar la imagen DICOM. Verificá que el archivo sea válido.');
        }
      }
    }

    loadImage();

    return () => {
      cancelled = true;
      try { cornerstoneCache?.disable(element); } catch { /* ignore */ }
    };
  }, [cornerstoneReady, fileUrl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-sm text-on-surface-variant">Cargando visor DICOM...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded border border-yellow-200 bg-yellow-50 p-6 text-center">
        <p className="text-sm text-yellow-800 font-medium">{error}</p>
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Descargar archivo DICOM
        </a>
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
      <div
        ref={elementRef}
        className="w-full h-96 bg-black rounded"
        style={{ minWidth: 300, minHeight: 300 }}
      />
    </div>
  );
}

/**
 * Lazy wrapper — use this for code splitting:
 *
 *   const LazyDicomViewer = React.lazy(() => import('./dicom-viewer').then(m => ({ default: m.DicomViewer })));
 *   <Suspense fallback={<Spinner />}><LazyDicomViewer ... /></Suspense>
 *
 * Or import DicomViewer directly if you don't need code splitting.
 */
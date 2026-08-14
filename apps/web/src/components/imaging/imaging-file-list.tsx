'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { usePresignedUrl } from '@/hooks/useImagingStudies';
import {
  imagingFileKind,
  normalizeImagingFile,
  type RawImagingFile,
} from './imaging-file';

const DicomViewer = dynamic(
  () => import('./dicom-viewer').then((module) => module.DicomViewer),
  {
    ssr: false,
    loading: () => <p className="mt-3 text-xs text-on-surface-variant">Cargando visor DICOM...</p>,
  },
);

interface ImagingFileListProps {
  patientId: string;
  studyId: string;
  files: RawImagingFile[];
}

function FileAccessMessage() {
  return <p className="text-xs text-on-surface-variant">Sin referencia de storage disponible para este archivo.</p>;
}

function ImagingFileItem({ patientId, studyId, file }: { patientId: string; studyId: string; file: RawImagingFile }) {
  const normalized = normalizeImagingFile(file);
  const [showDicomViewer, setShowDicomViewer] = useState(false);
  const { data, error, isLoading } = usePresignedUrl(patientId, studyId, normalized.key ?? '');
  const accessUrl = normalized.url ?? data?.url;
  const kind = imagingFileKind(normalized.mimeType);

  return (
    <li className="rounded border border-outline-variant bg-surface-lowest p-3">
      <div className="flex items-start gap-3">
        {kind === 'image' && accessUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={accessUrl} alt={normalized.originalName} className="h-16 w-16 rounded object-cover" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-surface-container text-xs font-semibold text-on-surface-variant">
            {kind.toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium text-on-surface">{normalized.originalName}</p>
          <p className="text-xs text-on-surface-variant">{normalized.mimeType}</p>
          {isLoading && <p className="text-xs text-on-surface-variant">Obteniendo acceso...</p>}
          {error && <p className="text-xs text-red-600">No se pudo obtener el archivo.</p>}
          {kind === 'image' && !accessUrl && !isLoading && <FileAccessMessage />}
          {kind === 'pdf' && <p className="text-xs text-on-surface-variant">Abrir o descargar PDF.</p>}
          {kind === 'video' && accessUrl && <video controls preload="metadata" src={accessUrl} className="mt-2 max-h-48 w-full rounded" />}
          {kind === 'dicom' && <p className="text-xs text-on-surface-variant">Requiere el visor DICOM.</p>}
          {kind === 'zip' && <p className="text-xs text-on-surface-variant">Descarga disponible; no se previsualiza.</p>}
          {kind === 'other' && <p className="text-xs text-on-surface-variant">Formato no compatible con vista previa.</p>}
          {accessUrl && (
            <div className="flex flex-wrap gap-3 pt-1 text-xs">
              {kind === 'dicom' && (
                <button type="button" className="text-primary underline" onClick={() => setShowDicomViewer((value) => !value)}>
                  {showDicomViewer ? 'Ocultar visor DICOM' : 'Abrir visor DICOM'}
                </button>
              )}
              <a
                href={accessUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={kind === 'zip' ? normalized.originalName : undefined}
                className="text-primary underline"
              >
                {kind === 'zip' ? 'Descargar ZIP' : 'Abrir / descargar'}
              </a>
            </div>
          )}
        </div>
      </div>
      {showDicomViewer && accessUrl && <div className="mt-3"><DicomViewer fileUrl={accessUrl} studyId={studyId} /></div>}
    </li>
  );
}

export function ImagingFileList({ patientId, studyId, files }: ImagingFileListProps) {
  if (files.length === 0) return <p className="text-sm text-on-surface-variant">Este estudio no tiene archivos.</p>;

  return (
    <ul className="space-y-3">
      {files.map((file, index) => (
        <ImagingFileItem key={`${normalizeImagingFile(file).originalName}-${index}`} patientId={patientId} studyId={studyId} file={file} />
      ))}
    </ul>
  );
}

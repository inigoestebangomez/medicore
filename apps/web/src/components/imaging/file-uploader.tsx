'use client';

// apps/web/src/components/imaging/file-uploader.tsx
// BR-IMG-001: MIME type validation (image/jpeg, image/png, image/webp, application/dicom, video/mp4, video/quicktime, application/pdf, application/zip)
// BR-IMG-002: File size limits per MIME type
// BR-IMG-003: Max 20 files per upload request (per-study limit of 100 handled server-side)

import React, { useCallback, useRef, useState } from 'react';
import { useUploadFiles } from '@/hooks/useImagingStudies';
import {
  IMAGING_FILE_ACCEPT,
  prepareImagingFileForUpload,
  resolveImagingMimeType,
  validateImagingFile,
  formatImagingSize,
} from './imaging-file';

// ─────────────────────────────────────────────
// Constants (matches backend FileValidationPipe)
// ─────────────────────────────────────────────

const MAX_FILES_PER_UPLOAD = 20;

interface FileState {
  file: File;
  id: string;
  previewUrl?: string;
  error?: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

interface FileUploaderProps {
  patientId: string;
  studyId: string;
  onUploadComplete?: () => void;
  disabled?: boolean;
}

export function FileUploader({ patientId, studyId, onUploadComplete, disabled }: FileUploaderProps) {
  const [files, setFiles] = useState<FileState[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadFiles(patientId, studyId);

  const validateFile = useCallback((file: File): string | undefined => {
    return validateImagingFile(file);
  }, []);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    const currentCount = files.filter((f) => f.status !== 'error').length;

    if (currentCount + incoming.length > MAX_FILES_PER_UPLOAD) {
      setSelectionError(`Máximo ${MAX_FILES_PER_UPLOAD} archivos por carga.`);
      return;
    }

    setSelectionError(null);

    const newStates: FileState[] = incoming.map((file) => {
      const error = validateFile(file);
      let previewUrl: string | undefined;
      if (resolveImagingMimeType(file.name, file.type)?.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file);
      }
      return {
        file,
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        previewUrl,
        error,
        status: error ? 'error' : 'pending',
      };
    });

    setFiles((prev) => [...prev, ...newStates]);
  }, [files, validateFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    addFiles(e.dataTransfer.files);
  }, [addFiles, disabled]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleRemove = useCallback((id: string) => {
    setFiles((prev) => {
      const f = prev.find((s) => s.id === id);
      if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
  }, []);

  const handleUpload = useCallback(async () => {
    const validFiles = files.filter((f) => f.status === 'pending');
    if (validFiles.length === 0) return;

    setFiles((prev) =>
      prev.map((f) =>
        validFiles.some((v) => v.id === f.id) ? { ...f, status: 'uploading' as const } : f,
      ),
    );

    const formData = new FormData();
    validFiles.forEach((f) => formData.append('files', prepareImagingFileForUpload(f.file)));

    try {
      await uploadMutation.mutateAsync(formData);
      setFiles((prev) =>
        prev.map((f) =>
          validFiles.some((v) => v.id === f.id) ? { ...f, status: 'done' as const } : f,
        ),
      );
      onUploadComplete?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al subir archivos';
      setFiles((prev) =>
        prev.map((f) =>
          validFiles.some((v) => v.id === f.id) ? { ...f, status: 'error' as const, error: message } : f,
        ),
      );
    }
  }, [files, uploadMutation, onUploadComplete]);

  const pendingCount = files.filter((f) => f.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${dragOver ? 'border-secondary bg-secondary-container/20' : 'border-outline hover:border-gray-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={IMAGING_FILE_ACCEPT}
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          className="hidden"
          disabled={disabled}
        />
        <p className="text-sm text-on-surface-variant">
          Arrastrá archivos acá o hacé click para seleccionar
        </p>
        <p className="text-xs text-on-surface-variant/60 mt-1">
          JPG, PNG, WebP, DICOM, MP4, MOV, PDF o ZIP. Máx. {MAX_FILES_PER_UPLOAD} archivos.
        </p>
        {selectionError && <p className="mt-2 text-xs text-red-600">{selectionError}</p>}
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded border border-outline-variant bg-surface-lowest p-3 text-sm"
            >
              {/* Preview */}
              {f.previewUrl ? (
                <img
                  src={f.previewUrl}
                  alt={f.file.name}
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded bg-surface-container text-xs text-on-surface-variant">
                  {(resolveImagingMimeType(f.file.name, f.file.type)?.split('/').pop()?.toUpperCase().slice(0, 4) ?? 'FILE')}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-on-surface">{f.file.name}</p>
                <p className="text-xs text-on-surface-variant">{formatImagingSize(f.file.size)}</p>
              </div>

              {/* Status */}
              {f.status === 'uploading' && (
                <span className="text-xs text-secondary animate-pulse">Subiendo...</span>
              )}
              {f.status === 'done' && (
                <span className="text-xs text-green-600 font-medium">✓</span>
              )}
              {f.error && (
                <span className="text-xs text-red-600">{f.error}</span>
              )}

              {/* Remove */}
              {f.status !== 'uploading' && (
                <button
                  type="button"
                  onClick={() => handleRemove(f.id)}
                  className="text-on-surface-variant/60 hover:text-red-500"
                  aria-label="Eliminar archivo"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Upload button */}
      {pendingCount > 0 && (
        <button
          type="button"
          onClick={handleUpload}
          disabled={disabled || uploadMutation.isPending}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {uploadMutation.isPending ? 'Subiendo...' : `Subir ${pendingCount} archivo${pendingCount > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}

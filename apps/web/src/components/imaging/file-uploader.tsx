'use client';

// apps/web/src/components/imaging/file-uploader.tsx
// BR-IMG-001: MIME type validation (image/jpeg, image/png, image/webp, application/dicom, video/mp4, video/quicktime, application/pdf, application/zip)
// BR-IMG-002: File size limits per MIME type
// BR-IMG-003: Max 20 files per upload request (per-study limit of 100 handled server-side)

import React, { useCallback, useRef, useState } from 'react';
import { useUploadFiles } from '@/hooks/useImagingStudies';

// ─────────────────────────────────────────────
// Constants (matches backend FileValidationPipe)
// ─────────────────────────────────────────────

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/dicom',
  'video/mp4',
  'video/quicktime',
  'application/pdf',
  'application/zip',
] as const;

const SIZE_LIMITS: Record<string, number> = {
  'image/jpeg': 50 * 1024 * 1024,
  'image/png': 50 * 1024 * 1024,
  'image/webp': 50 * 1024 * 1024,
  'application/dicom': 200 * 1024 * 1024,
  'video/mp4': 500 * 1024 * 1024,
  'video/quicktime': 500 * 1024 * 1024,
  'application/pdf': 25 * 1024 * 1024,
  'application/zip': 500 * 1024 * 1024,
};

const MAX_FILES_PER_UPLOAD = 20;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadFiles(patientId, studyId);

  const validateFile = useCallback((file: File): string | undefined => {
    if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
      return `Tipo no permitido: ${file.type}`;
    }
    const maxSize = SIZE_LIMITS[file.type] ?? 0;
    if (file.size > maxSize) {
      return `Archivo muy grande (${formatSize(file.size)}), máximo ${formatSize(maxSize)}`;
    }
    return undefined;
  }, []);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    const currentCount = files.filter((f) => f.status !== 'error').length;

    if (currentCount + incoming.length > MAX_FILES_PER_UPLOAD) {
      alert(`Máximo ${MAX_FILES_PER_UPLOAD} archivos por carga`);
      return;
    }

    const newStates: FileState[] = incoming.map((file) => {
      const error = validateFile(file);
      let previewUrl: string | undefined;
      if (file.type.startsWith('image/')) {
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
    validFiles.forEach((f) => formData.append('files', f.file));

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
          ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_MIME_TYPES.join(',')}
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          className="hidden"
          disabled={disabled}
        />
        <p className="text-sm text-gray-600">
          Arrastrá archivos acá o hacé click para seleccionar
        </p>
        <p className="text-xs text-gray-400 mt-1">
          DICOM, imágenes, video, PDF — máx. {MAX_FILES_PER_UPLOAD} archivos
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded border border-gray-200 bg-white p-3 text-sm"
            >
              {/* Preview */}
              {f.previewUrl ? (
                <img
                  src={f.previewUrl}
                  alt={f.file.name}
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100 text-xs text-gray-500">
                  {f.file.type.split('/').pop()?.toUpperCase().slice(0, 4) ?? 'FILE'}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-gray-900">{f.file.name}</p>
                <p className="text-xs text-gray-500">{formatSize(f.file.size)}</p>
              </div>

              {/* Status */}
              {f.status === 'uploading' && (
                <span className="text-xs text-blue-600 animate-pulse">Subiendo...</span>
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
                  className="text-gray-400 hover:text-red-500"
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
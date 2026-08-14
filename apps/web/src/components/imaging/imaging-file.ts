export const SUPPORTED_IMAGING_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/dicom',
  'video/mp4',
  'video/quicktime',
  'application/pdf',
  'application/zip',
] as const;

export const IMAGING_FILE_ACCEPT = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.dcm',
  '.dicom',
  '.mp4',
  '.mov',
  '.pdf',
  '.zip',
  ...SUPPORTED_IMAGING_MIME_TYPES,
].join(',');

export const IMAGING_SIZE_LIMITS: Record<string, number> = {
  'image/jpeg': 50 * 1024 * 1024,
  'image/png': 50 * 1024 * 1024,
  'image/webp': 50 * 1024 * 1024,
  'application/dicom': 200 * 1024 * 1024,
  'video/mp4': 500 * 1024 * 1024,
  'video/quicktime': 500 * 1024 * 1024,
  'application/pdf': 25 * 1024 * 1024,
  'application/zip': 500 * 1024 * 1024,
};

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  dcm: 'application/dicom',
  dicom: 'application/dicom',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
  zip: 'application/zip',
};

export type RawImagingFile = {
  key?: unknown;
  originalName?: unknown;
  mimeType?: unknown;
  size?: unknown;
  uploadedAt?: unknown;
  url?: unknown;
  name?: unknown;
};

export interface NormalizedImagingFile {
  key?: string;
  originalName: string;
  mimeType: string;
  size?: number;
  uploadedAt?: string;
  url?: string;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() && value !== 'undefined' && value !== 'null'
    ? value
    : undefined;
}

export function inferImagingMimeType(fileName: string): string | undefined {
  const extension = fileName.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
  return extension ? MIME_BY_EXTENSION[extension] : undefined;
}

export function resolveImagingMimeType(fileName: string, declaredMimeType?: string): string | undefined {
  const declared = nonEmptyString(declaredMimeType);
  if (declared && (SUPPORTED_IMAGING_MIME_TYPES as readonly string[]).includes(declared)) {
    return declared;
  }
  if (!declared || declared === 'application/octet-stream') {
    return inferImagingMimeType(fileName);
  }
  return declared;
}

export function normalizeImagingFile(file: RawImagingFile): NormalizedImagingFile {
  const key = nonEmptyString(file.key);
  const url = nonEmptyString(file.url);
  const originalName =
    nonEmptyString(file.originalName) ??
    nonEmptyString(file.name) ??
    key?.split('/').pop() ??
    'Archivo sin nombre';
  const mimeType = resolveImagingMimeType(originalName, nonEmptyString(file.mimeType)) ?? 'application/octet-stream';
  const size = typeof file.size === 'number' && Number.isFinite(file.size) ? file.size : undefined;
  const uploadedAt = nonEmptyString(file.uploadedAt);

  return { key, url, originalName, mimeType, size, uploadedAt };
}

export function imagingFileKind(mimeType: string): 'image' | 'pdf' | 'video' | 'dicom' | 'zip' | 'other' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/dicom') return 'dicom';
  if (mimeType === 'application/zip') return 'zip';
  return 'other';
}

export function validateImagingFile(file: { name: string; type: string; size: number }): string | undefined {
  const mimeType = resolveImagingMimeType(file.name, file.type);
  if (!mimeType || !(SUPPORTED_IMAGING_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return `Tipo no permitido: ${file.type || 'MIME ausente'} (${file.name})`;
  }
  const maxSize = IMAGING_SIZE_LIMITS[mimeType];
  if (file.size > maxSize) {
    return `Archivo muy grande: ${file.name}. Máximo ${formatImagingSize(maxSize)}`;
  }
  return undefined;
}

export function formatImagingSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function prepareImagingFileForUpload(file: File): File {
  const mimeType = resolveImagingMimeType(file.name, file.type);
  if (!mimeType || mimeType === file.type) return file;
  return new File([file], file.name, { type: mimeType, lastModified: file.lastModified });
}

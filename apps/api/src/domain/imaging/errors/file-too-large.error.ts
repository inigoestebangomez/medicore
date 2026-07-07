// apps/api/src/domain/imaging/errors/file-too-large.error.ts

export class FileTooLargeError extends Error {
  public readonly fileName: string;
  public readonly size: number;
  public readonly maxSize: number;
  public readonly code = 'FILE_TOO_LARGE';

  constructor(fileName: string, size: number, maxSize: number) {
    super(`File too large: ${fileName} (${size} bytes exceeds ${maxSize} bytes)`);
    this.name = 'FileTooLargeError';
    this.fileName = fileName;
    this.size = size;
    this.maxSize = maxSize;
  }
}
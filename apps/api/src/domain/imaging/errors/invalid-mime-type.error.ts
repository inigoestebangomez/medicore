// apps/api/src/domain/imaging/errors/invalid-mime-type.error.ts

export class InvalidMimeTypeError extends Error {
  public readonly mimeType: string;
  public readonly allowed: string[];
  public readonly code = 'INVALID_MIME_TYPE';

  constructor(mimeType: string, allowed: string[]) {
    super(`Invalid MIME type: ${mimeType}. Allowed: ${allowed.join(', ')}`);
    this.name = 'InvalidMimeTypeError';
    this.mimeType = mimeType;
    this.allowed = allowed;
  }
}
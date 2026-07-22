// apps/api/src/domain/import/errors/file-empty.error.ts

export class FileEmptyError extends Error {
  public readonly code = 'FILE_EMPTY';

  constructor(message = 'Uploaded file contains no parseable rows') {
    super(message);
    this.name = 'FileEmptyError';
  }
}
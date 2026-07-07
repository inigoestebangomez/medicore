// apps/api/src/domain/imaging/errors/imaging-study-not-found.error.ts

export class ImagingStudyNotFoundError extends Error {
  public readonly id: string;
  public readonly code = 'IMAGING_NOT_FOUND';

  constructor(id: string) {
    super(`Imaging study not found: ${id}`);
    this.name = 'ImagingStudyNotFoundError';
    this.id = id;
  }
}
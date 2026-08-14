export class InvalidImagingStudyIdError extends Error {
  public readonly code = 'INVALID_IMAGING_STUDY_ID';

  constructor(id: unknown) {
    super(`Invalid imaging study id: ${String(id)}`);
    this.name = 'InvalidImagingStudyIdError';
  }
}

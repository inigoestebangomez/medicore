import { InvalidImagingStudyIdError } from './errors/invalid-imaging-study-id.error';

export function assertValidImagingStudyId(id: unknown): asserts id is string {
  if (
    typeof id !== 'string' ||
    id.trim().length === 0 ||
    id === 'undefined' ||
    id === 'null'
  ) {
    throw new InvalidImagingStudyIdError(id);
  }
}

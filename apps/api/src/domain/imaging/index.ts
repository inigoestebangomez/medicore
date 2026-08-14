// apps/api/src/domain/imaging/index.ts
export { ImagingStudy } from './imaging-study.entity';
export type { ImagingStudyProps, FileMetadataEntry, LabelEntry } from './imaging-study.entity';
export type { IImagingStudyRepository, ListImagingStudiesParams, CreateImagingStudyInput, UpdateImagingStudyInput } from './imaging-study.repository.interface';
export type { IPendingDeletionRepository, PendingDeletionRecord, CreatePendingDeletionInput } from './pending-deletion.repository.interface';
export { ImagingStudyNotFoundError } from './errors/imaging-study-not-found.error';
export { InvalidImagingStudyIdError } from './errors/invalid-imaging-study-id.error';
export { StudyAlreadyDeletedError } from './errors/study-already-deleted.error';
export { InvalidMimeTypeError } from './errors/invalid-mime-type.error';
export { FileTooLargeError } from './errors/file-too-large.error';
export { FileCountExceededError } from './errors/file-count-exceeded.error';

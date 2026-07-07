// apps/api/src/domain/imaging/errors/study-already-deleted.error.ts

export class StudyAlreadyDeletedError extends Error {
  public readonly id: string;
  public readonly code = 'STUDY_ALREADY_DELETED';

  constructor(id: string) {
    super(`Imaging study already deleted: ${id}`);
    this.name = 'StudyAlreadyDeletedError';
    this.id = id;
  }
}
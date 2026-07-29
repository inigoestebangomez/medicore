// apps/api/src/domain/research/errors/study-not-found.error.ts
export class StudyNotFoundError extends Error {
  constructor(public readonly studyId: string) {
    super(`ResearchStudy not found: ${studyId}`);
    this.name = 'StudyNotFoundError';
  }
}

export class StudyOwnershipError extends Error {
  constructor(public readonly studyId: string, public readonly userId: string) {
    super(`User ${userId} is not the owner of study ${studyId} (BR-RES-009)`);
    this.name = 'StudyOwnershipError';
  }
}

export class StudyStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StudyStateError';
  }
}
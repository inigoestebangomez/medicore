// apps/api/src/domain/imaging/errors/file-count-exceeded.error.ts

export class FileCountExceededError extends Error {
  public readonly currentCount: number;
  public readonly additionCount: number;
  public readonly maxCount: number;
  public readonly code = 'FILE_COUNT_EXCEEDED';

  constructor(currentCount: number, additionCount: number, maxCount: number) {
    super(`File count exceeded: ${currentCount} + ${additionCount} > ${maxCount}`);
    this.name = 'FileCountExceededError';
    this.currentCount = currentCount;
    this.additionCount = additionCount;
    this.maxCount = maxCount;
  }
}
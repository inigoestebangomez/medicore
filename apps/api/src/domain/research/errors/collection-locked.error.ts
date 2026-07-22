// apps/api/src/domain/research/errors/collection-locked.error.ts
// BR-RES-003: locked (published) collections are immutable.

export class CollectionLockedError extends Error {
  public readonly code = 'COLLECTION_LOCKED';

  constructor(collectionId: string) {
    super(
      `Collection ${collectionId} is locked (published) and cannot be modified — BR-RES-003`,
    );
    this.name = 'CollectionLockedError';
  }
}
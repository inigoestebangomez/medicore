// apps/api/src/domain/research/errors/collection-not-found.error.ts

export class CollectionNotFoundError extends Error {
  public readonly code = 'COLLECTION_NOT_FOUND';

  constructor(id: string) {
    super(`Patient collection not found: ${id}`);
    this.name = 'CollectionNotFoundError';
  }
}
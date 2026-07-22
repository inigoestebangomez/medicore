// apps/api/src/domain/research/research-query-not-found.error.ts

export class ResearchQueryNotFoundError extends Error {
  public readonly code = 'RESEARCH_QUERY_NOT_FOUND';

  constructor(id: string) {
    super(`Research query not found: ${id}`);
    this.name = 'ResearchQueryNotFoundError';
  }
}
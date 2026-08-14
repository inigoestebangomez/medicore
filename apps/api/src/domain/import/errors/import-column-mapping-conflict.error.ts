import type { ColumnMappingConflict } from '@medicore/contracts';

export class ImportColumnMappingConflictError extends Error {
  constructor(public readonly conflicts: ColumnMappingConflict[]) {
    super(conflicts.map(({ message }) => message).join(' '));
    this.name = 'ImportColumnMappingConflictError';
  }
}

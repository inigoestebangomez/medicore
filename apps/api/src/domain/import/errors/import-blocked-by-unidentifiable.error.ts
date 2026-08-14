export class ImportBlockedByUnidentifiableError extends Error {
  constructor(public readonly rowCount: number) {
    super(`Resolve the ${rowCount} pending import row${rowCount === 1 ? '' : 's'} before finalizing`);
    this.name = 'ImportBlockedByUnidentifiableError';
  }
}

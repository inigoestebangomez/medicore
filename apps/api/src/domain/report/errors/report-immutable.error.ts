export class ReportImmutableError extends Error {
  constructor(reportId: string) {
    super(`Report ${reportId} is SIGNED and cannot be modified`);
    this.name = 'ReportImmutableError';
  }
}

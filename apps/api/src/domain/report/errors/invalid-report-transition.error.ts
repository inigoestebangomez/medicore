export class InvalidReportTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid report status transition: ${from} → ${to}`);
    this.name = 'InvalidReportTransitionError';
  }
}

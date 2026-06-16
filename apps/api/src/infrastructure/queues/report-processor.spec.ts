// apps/api/src/infrastructure/queues/report-processor.spec.ts
import { ReportProcessor } from './report-processor';

describe('ReportProcessor', () => {
  let processor: ReportProcessor;

  beforeEach(() => {
    processor = new ReportProcessor();
  });

  it('should handle generate report job without throwing', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const job = {
      data: {
        consultationId: 'cons-1',
        patientId: 'patient-1',
        organizationId: 'org-1',
      },
    } as any;

    await expect(processor.handleGenerateReport(job)).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      '[ReportProcessor] Report generation requested for consultation cons-1',
    );

    consoleSpy.mockRestore();
  });
});

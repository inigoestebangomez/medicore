// apps/api/src/infrastructure/queues/report-processor.spec.ts
import { ReportProcessor } from './report-processor';

describe('ReportProcessor', () => {
  let processor: ReportProcessor;
  let mockAnthropic: { generateReport: jest.Mock };

  beforeEach(() => {
    mockAnthropic = {
      generateReport: jest.fn().mockResolvedValue('Generated report content'),
    };
    processor = new ReportProcessor(mockAnthropic as any);
  });

  it('should handle generate report job and call anthropic service', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const job = {
      data: {
        consultationId: 'cons-1',
        patientId: 'patient-1',
        organizationId: 'org-1',
      },
    } as any;

    const result = await processor.handleGenerateReport(job);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[ReportProcessor] Report generation requested for consultation cons-1',
    );
    expect(mockAnthropic.generateReport).toHaveBeenCalled();
    expect(result).toEqual({ content: 'Generated report content' });

    consoleSpy.mockRestore();
  });
});

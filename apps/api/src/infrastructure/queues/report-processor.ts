// apps/api/src/infrastructure/queues/report-processor.ts
// BullMQ stub for report generation. Phase 7 will implement AI report generation.

import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bullmq';

interface ConsultationJobData {
  consultationId: string;
  patientId: string;
  organizationId: string;
}

interface SurgeryJobData {
  surgeryId: string;
  patientId: string;
  organizationId: string;
}

type ReportJobData = ConsultationJobData | SurgeryJobData;

function isSurgeryJob(data: ReportJobData): data is SurgeryJobData {
  return 'surgeryId' in data;
}

@Processor('generate-report')
export class ReportProcessor {
  @Process('generate')
  async handleGenerateReport(job: Job<ReportJobData>) {
    if (isSurgeryJob(job.data)) {
      // Stub: log and complete. Phase 7 will implement AI report generation for surgeries.
      console.log(`[ReportProcessor] Report generation requested for surgery ${job.data.surgeryId}`);
    } else {
      // Stub: log and complete. Phase 7 will implement AI report generation for consultations.
      console.log(`[ReportProcessor] Report generation requested for consultation ${job.data.consultationId}`);
    }
  }
}
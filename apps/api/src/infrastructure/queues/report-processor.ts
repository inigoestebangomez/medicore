// apps/api/src/infrastructure/queues/report-processor.ts
// BullMQ worker for report generation. Phase 7 AI report generation.
// AnthropicService is wired for when Redis/BullMQ is active.

import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bullmq';
import { AnthropicService, ReportGenerationInput } from '@/infrastructure/ai/anthropic.service';

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
  constructor(private readonly anthropicService: AnthropicService) {}

  @Process('generate')
  async handleGenerateReport(job: Job<ReportJobData>) {
    if (isSurgeryJob(job.data)) {
      console.log(`[ReportProcessor] Report generation requested for surgery ${job.data.surgeryId}`);
    } else {
      console.log(`[ReportProcessor] Report generation requested for consultation ${job.data.consultationId}`);
    }

    // Generate report content via Anthropic
    const input: ReportGenerationInput = {
      patientName: 'Paciente',
      patientNhc: 'N/A',
      consultationType: isSurgeryJob(job.data) ? 'SURGICAL_REPORT' : 'CONSULTATION',
      chiefComplaint: 'Generado desde cola BullMQ',
    };

    const content = await this.anthropicService.generateReport(input);
    console.log(`[ReportProcessor] Report content generated (${content.length} chars)`);

    return { content };
  }
}

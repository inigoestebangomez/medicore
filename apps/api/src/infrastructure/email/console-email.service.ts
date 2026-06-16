// apps/api/src/infrastructure/email/console-email.service.ts
import type { IEmailService } from './email.service.interface';

export class ConsoleEmailService implements IEmailService {
  async sendInvitation(params: {
    to: string;
    organizationName: string;
    acceptUrl: string;
    role: string;
  }): Promise<void> {
    console.log(
      `[ConsoleEmailService] Invitation sent to ${params.to} for ${params.organizationName} as ${params.role}. Accept URL: ${params.acceptUrl}`,
    );
  }

  async sendWelcome(params: {
    to: string;
    userName: string;
    organizationName: string;
  }): Promise<void> {
    console.log(
      `[ConsoleEmailService] Welcome email sent to ${params.to} (${params.userName}) for ${params.organizationName}`,
    );
  }
}
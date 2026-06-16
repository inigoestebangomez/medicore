// apps/api/src/infrastructure/email/email.service.interface.ts
import type { MemberRole } from '@medicore/contracts';

export interface IEmailService {
  sendInvitation(params: {
    to: string;
    organizationName: string;
    acceptUrl: string;
    role: MemberRole;
  }): Promise<void>;

  sendWelcome(params: {
    to: string;
    userName: string;
    organizationName: string;
  }): Promise<void>;
}
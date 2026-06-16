// apps/api/src/domain/invitation/invitation.repository.interface.ts
import { Invitation } from './invitation.entity';
import { MemberRole } from '@medicore/contracts';

export interface IInvitationRepository {
  findByTokenHash(tokenHash: string): Promise<Invitation | null>;
  findByOrgId(organizationId: string): Promise<Invitation[]>;
  create(data: {
    email: string;
    tokenHash: string;
    role: MemberRole;
    organizationId: string;
    invitedBy: string;
    expiresAt: Date;
  }): Promise<Invitation>;
  markAsUsed(id: string): Promise<Invitation>;
  delete(id: string): Promise<void>;
  findByEmailAndOrg(email: string, organizationId: string): Promise<Invitation | null>;
}
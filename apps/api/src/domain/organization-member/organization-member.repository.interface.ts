// apps/api/src/domain/organization-member/organization-member.repository.interface.ts
import { MemberRole } from '@medicore/contracts';
import { OrganizationMember } from './organization-member.entity';

export interface IOrganizationMemberRepository {
  findByUserId(userId: string): Promise<OrganizationMember[]>;
  findByOrgId(organizationId: string): Promise<OrganizationMember[]>;
  findByOrgAndUser(organizationId: string, userId: string): Promise<OrganizationMember | null>;
  create(data: {
    organizationId: string;
    userId: string;
    role: MemberRole;
    invitedBy?: string | null;
  }): Promise<OrganizationMember>;
  delete(id: string): Promise<void>;
  updateRole(id: string, role: MemberRole): Promise<OrganizationMember>;
  countOwnersInOrg(organizationId: string): Promise<number>;
}
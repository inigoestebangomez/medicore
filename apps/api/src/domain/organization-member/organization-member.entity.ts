// apps/api/src/domain/organization-member/organization-member.entity.ts
import type { MemberRole } from '@medicore/contracts';
import { MemberRoleSchema } from '@medicore/contracts';

export class OrganizationMember {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly role: MemberRole;
  readonly invitedBy: string | null;
  readonly joinedAt: Date;
  readonly updatedAt: Date;

  constructor(props: {
    id: string;
    organizationId: string;
    userId: string;
    role?: MemberRole;
    invitedBy?: string | null;
    joinedAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.role = props.role ?? MemberRoleSchema.Values.PHYSICIAN;
    this.invitedBy = props.invitedBy ?? null;
    this.joinedAt = props.joinedAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }
}
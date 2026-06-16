// apps/api/src/domain/invitation/invitation.entity.ts
import { MemberRole } from '@medicore/contracts';

export class Invitation {
  readonly id: string;
  readonly email: string;
  readonly tokenHash: string;
  readonly role: MemberRole;
  readonly organizationId: string;
  readonly invitedBy: string;
  readonly expiresAt: Date;
  readonly usedAt: Date | null;
  readonly createdAt: Date;

  constructor(props: {
    id: string;
    email: string;
    tokenHash: string;
    role: MemberRole;
    organizationId: string;
    invitedBy: string;
    expiresAt: Date;
    usedAt?: Date | null;
    createdAt?: Date;
  }) {
    this.id = props.id;
    this.email = props.email;
    this.tokenHash = props.tokenHash;
    this.role = props.role;
    this.organizationId = props.organizationId;
    this.invitedBy = props.invitedBy;
    this.expiresAt = props.expiresAt;
    this.usedAt = props.usedAt ?? null;
    this.createdAt = props.createdAt ?? new Date();
  }

  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  isUsed(): boolean {
    return this.usedAt !== null;
  }
}
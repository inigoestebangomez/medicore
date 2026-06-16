// apps/api/src/domain/user/user.entity.ts
// Domain entity: User — no framework dependencies

import { MemberRole } from '@medicore/contracts';

export class User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly oauthProvider: string;
  readonly oauthSub: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string | null;
    oauthProvider: string;
    oauthSub?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = props.id;
    this.email = props.email;
    this.name = props.name;
    this.avatarUrl = props.avatarUrl ?? null;
    this.oauthProvider = props.oauthProvider;
    this.oauthSub = props.oauthSub ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  /**
   * Checks if this user can perform an action requiring a specific role
   * within a given organization.
   */
  hasRole(memberships: { organizationId: string; role: MemberRole }[], organizationId: string): boolean {
    return memberships.some(
      (m) => m.organizationId === organizationId,
    );
  }
}
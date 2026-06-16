// apps/api/src/application/auth/sync-oauth-user.use-case.ts
import { User } from '@/domain/user/user.entity';
import { IUserRepository } from '@/domain/user/user.repository.interface';

export interface SyncOAuthUserInput {
  oauthProvider: string;
  oauthSub: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export interface SyncOAuthUserOutput {
  user: User;
  isNewUser: boolean;
}

export class SyncOAuthUserUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(input: SyncOAuthUserInput): Promise<SyncOAuthUserOutput> {
    // Idempotent: find by oauthSub first, then by email, then create
    const existingBySub = await this.userRepo.findByOAuthSub(input.oauthSub);
    if (existingBySub) {
      // Update name/avatar on existing user
      const updated = await this.userRepo.upsert({
        email: input.email,
        name: input.name,
        avatarUrl: input.avatarUrl,
        oauthProvider: input.oauthProvider,
        oauthSub: input.oauthSub,
      });
      return { user: updated, isNewUser: false };
    }

    const existingByEmail = await this.userRepo.findByEmail(input.email);
    if (existingByEmail) {
      // Link OAuth sub to existing user
      const updated = await this.userRepo.upsert({
        email: input.email,
        name: input.name,
        avatarUrl: input.avatarUrl,
        oauthProvider: input.oauthProvider,
        oauthSub: input.oauthSub,
      });
      return { user: updated, isNewUser: false };
    }

    // Create new user
    const user = await this.userRepo.upsert({
      email: input.email,
      name: input.name,
      avatarUrl: input.avatarUrl,
      oauthProvider: input.oauthProvider,
      oauthSub: input.oauthSub,
    });
    return { user, isNewUser: true };
  }
}
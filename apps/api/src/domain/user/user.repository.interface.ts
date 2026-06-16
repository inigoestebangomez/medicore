// apps/api/src/domain/user/user.repository.interface.ts
// Repository interface for User — no implementation details

import { User } from './user.entity';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByOAuthSub(oauthSub: string): Promise<User | null>;
  upsert(data: {
    email: string;
    name: string;
    avatarUrl?: string | null;
    oauthProvider: string;
    oauthSub: string;
  }): Promise<User>;
  findAll(): Promise<User[]>;
}
import { User } from './user.entity';
import { IUserRepository } from './user.repository.interface';

/**
 * In-memory User repository for unit tests.
 * Not for production use — PrismaUserRepository is the real implementation.
 */
export class InMemoryUserRepository implements IUserRepository {
  private readonly users: Map<string, User> = new Map();
  private readonly emailIndex: Map<string, User> = new Map();
  private readonly oauthSubIndex: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.emailIndex.get(email) ?? null;
  }

  async findByOAuthSub(oauthSub: string): Promise<User | null> {
    return this.oauthSubIndex.get(oauthSub) ?? null;
  }

  async upsert(data: {
    email: string;
    name: string;
    avatarUrl?: string | null;
    oauthProvider: string;
    oauthSub: string;
  }): Promise<User> {
    // Try to find by oauthSub first, then by email
    const existingBySub = data.oauthSub ? this.oauthSubIndex.get(data.oauthSub) : null;
    if (existingBySub) {
      const updated = new User({
        id: existingBySub.id,
        email: data.email,
        name: data.name,
        avatarUrl: data.avatarUrl ?? existingBySub.avatarUrl,
        oauthProvider: data.oauthProvider,
        oauthSub: data.oauthSub,
        createdAt: existingBySub.createdAt,
        updatedAt: new Date(),
      });
      this.users.set(updated.id, updated);
      this.emailIndex.set(updated.email, updated);
      if (data.oauthSub) {
        this.oauthSubIndex.set(data.oauthSub, updated);
      }
      return updated;
    }

    const existingByEmail = this.emailIndex.get(data.email);
    if (existingByEmail) {
      const updated = new User({
        id: existingByEmail.id,
        email: data.email,
        name: data.name,
        avatarUrl: data.avatarUrl ?? existingByEmail.avatarUrl,
        oauthProvider: data.oauthProvider,
        oauthSub: data.oauthSub,
        createdAt: existingByEmail.createdAt,
        updatedAt: new Date(),
      });
      this.users.set(updated.id, updated);
      this.emailIndex.set(updated.email, updated);
      if (data.oauthSub) {
        this.oauthSubIndex.set(data.oauthSub, updated);
      }
      return updated;
    }

    // Create new user
    const user = new User({
      id: crypto.randomUUID(),
      email: data.email,
      name: data.name,
      avatarUrl: data.avatarUrl,
      oauthProvider: data.oauthProvider,
      oauthSub: data.oauthSub,
    });
    this.users.set(user.id, user);
    this.emailIndex.set(user.email, user);
    if (user.oauthSub) {
      this.oauthSubIndex.set(user.oauthSub, user);
    }
    return user;
  }

  async findAll(): Promise<User[]> {
    return Array.from(this.users.values());
  }
}
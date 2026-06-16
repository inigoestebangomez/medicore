// apps/api/src/application/auth/sync-oauth-user.use-case.spec.ts
import { SyncOAuthUserUseCase } from './sync-oauth-user.use-case';
import { InMemoryUserRepository } from '@/domain/user/in-memory-user.repository';

describe('SyncOAuthUserUseCase', () => {
  let useCase: SyncOAuthUserUseCase;
  let userRepo: InMemoryUserRepository;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    useCase = new SyncOAuthUserUseCase(userRepo);
  });

  it('should create a new user on first OAuth login', async () => {
    const result = await useCase.execute({
      oauthProvider: 'google',
      oauthSub: 'google-12345',
      email: 'new@example.com',
      name: 'New User',
      avatarUrl: 'https://example.com/avatar.jpg',
    });

    expect(result.user.email).toBe('new@example.com');
    expect(result.user.name).toBe('New User');
    expect(result.user.oauthProvider).toBe('google');
    expect(result.user.oauthSub).toBe('google-12345');
    expect(result.isNewUser).toBe(true);
  });

  it('should update existing user on subsequent login (idempotent)', async () => {
    // First login
    const first = await useCase.execute({
      oauthProvider: 'google',
      oauthSub: 'google-12345',
      email: 'user@example.com',
      name: 'Original Name',
    });
    expect(first.isNewUser).toBe(true);
    const originalId = first.user.id;

    // Second login — same oauthSub
    const second = await useCase.execute({
      oauthProvider: 'google',
      oauthSub: 'google-12345',
      email: 'user@example.com',
      name: 'Updated Name',
      avatarUrl: 'https://example.com/new-avatar.jpg',
    });

    expect(second.user.id).toBe(originalId);
    expect(second.user.name).toBe('Updated Name');
    expect(second.user.avatarUrl).toBe('https://example.com/new-avatar.jpg');
    expect(second.isNewUser).toBe(false);
  });

  it('should link OAuth sub to existing user by email', async () => {
    // Create user by email first (simulating different OAuth provider)
    const first = await useCase.execute({
      oauthProvider: 'microsoft',
      oauthSub: 'ms-abc',
      email: 'shared@example.com',
      name: 'Shared User',
    });
    expect(first.isNewUser).toBe(true);

    // Now login with Google, same email
    const second = await useCase.execute({
      oauthProvider: 'google',
      oauthSub: 'google-xyz',
      email: 'shared@example.com',
      name: 'Shared User',
    });

    // Should update the existing user (same id), not create a new one
    expect(second.user.id).toBe(first.user.id);
    expect(second.user.oauthSub).toBe('google-xyz');
    expect(second.isNewUser).toBe(false);
  });

  it('should return same userId for duplicate calls (race condition safety)', async () => {
    const first = await useCase.execute({
      oauthProvider: 'google',
      oauthSub: 'google-dup',
      email: 'dup@example.com',
      name: 'Dup User',
    });

    const second = await useCase.execute({
      oauthProvider: 'google',
      oauthSub: 'google-dup',
      email: 'dup@example.com',
      name: 'Dup User',
    });

    expect(first.user.id).toBe(second.user.id);
  });
});
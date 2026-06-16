import { User } from './user.entity';
describe('User Entity', () => {
  const baseProps = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    name: 'Test User',
    oauthProvider: 'google',
    oauthSub: 'google-12345',
  };

  it('should create a User with required fields', () => {
    const user = new User(baseProps);
    expect(user.id).toBe(baseProps.id);
    expect(user.email).toBe('test@example.com');
    expect(user.name).toBe('Test User');
    expect(user.oauthProvider).toBe('google');
    expect(user.oauthSub).toBe('google-12345');
    expect(user.avatarUrl).toBeNull();
  });

  it('should create a User with all fields including optional ones', () => {
    const user = new User({
      ...baseProps,
      avatarUrl: 'https://example.com/avatar.jpg',
    });
    expect(user.avatarUrl).toBe('https://example.com/avatar.jpg');
  });

  it('should default avatarUrl to null when not provided', () => {
    const user = new User(baseProps);
    expect(user.avatarUrl).toBeNull();
  });

  it('should default oauthSub to null when not provided', () => {
    const { oauthSub, ...noSub } = baseProps;
    const user = new User(noSub);
    expect(user.oauthSub).toBeNull();
  });

  it('should set createdAt and updatedAt to current date by default', () => {
    const before = new Date();
    const user = new User(baseProps);
    const after = new Date();
    expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(user.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('should use provided createdAt and updatedAt', () => {
    const created = new Date('2024-01-01');
    const updated = new Date('2024-06-01');
    const user = new User({ ...baseProps, createdAt: created, updatedAt: updated });
    expect(user.createdAt).toEqual(created);
    expect(user.updatedAt).toEqual(updated);
  });

  describe('hasRole', () => {
    it('should return true when user has a membership in the organization', () => {
      const user = new User(baseProps);
      const memberships = [
        { organizationId: 'org-1', role: 'OWNER' as const },
      ];
      expect(user.hasRole(memberships, 'org-1')).toBe(true);
    });

    it('should return false when user has no membership in the organization', () => {
      const user = new User(baseProps);
      const memberships = [
        { organizationId: 'org-1', role: 'OWNER' as const },
      ];
      expect(user.hasRole(memberships, 'org-2')).toBe(false);
    });

    it('should return false with empty memberships', () => {
      const user = new User(baseProps);
      expect(user.hasRole([], 'org-1')).toBe(false);
    });
  });
});
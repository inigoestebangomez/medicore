// apps/api/src/infrastructure/auth/jwt.strategy.spec.ts
import { JwtStrategy, extractJwtFromCookie } from './jwt.strategy';
import type { Request } from 'express';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-for-jwt-strategy-spec';
    strategy = new JwtStrategy();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should extract JWT from medicore-session cookie', async () => {
    const payload = {
      sub: 'user-123',
      email: 'test@example.com',
      name: 'Test',
      organizationId: 'org-456',
      role: 'OWNER' as const,
      iat: 1718000000,
      exp: 1718600000,
    };
    const result = await strategy.validate(payload);
    expect(result).toEqual(payload);
    expect(result.sub).toBe('user-123');
    expect(result.organizationId).toBe('org-456');
    expect(result.role).toBe('OWNER');
  });

  it('should preserve all JWT claims through validate', async () => {
    const payload = {
      sub: 'user-abc',
      email: 'admin@test.com',
      name: 'Admin User',
      organizationId: 'org-xyz',
      role: 'ADMIN' as const,
      iat: 1718000000,
      exp: 1718600000,
    };
    const result = await strategy.validate(payload);
    expect(result.email).toBe('admin@test.com');
    expect(result.name).toBe('Admin User');
    expect(result.iat).toBe(1718000000);
    expect(result.exp).toBe(1718600000);
  });
});

describe('extractJwtFromCookie', () => {
  it('should extract token from medicore-session cookie', () => {
    const req = {
      cookies: { 'medicore-session': 'jwt-token-value' },
    } as unknown as Request;
    expect(extractJwtFromCookie(req)).toBe('jwt-token-value');
  });

  it('should return null when cookie is not present', () => {
    const req = {
      cookies: {},
    } as unknown as Request;
    expect(extractJwtFromCookie(req)).toBeNull();
  });

  it('should return null when cookies object is undefined', () => {
    const req = {} as Request;
    expect(extractJwtFromCookie(req)).toBeNull();
  });

  it('should return null when request is null/undefined', () => {
    expect(extractJwtFromCookie(null as any)).toBeNull();
    expect(extractJwtFromCookie(undefined as any)).toBeNull();
  });

  it('should return the correct value even when other cookies exist', () => {
    const req = {
      cookies: {
        'medicore-session': 'the-jwt',
        'other-cookie': 'other-value',
        'lang': 'es',
      },
    } as unknown as Request;
    expect(extractJwtFromCookie(req)).toBe('the-jwt');
  });
});
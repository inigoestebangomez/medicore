// apps/api/src/api/shared/guards/auth.guard.spec.ts
import { AuthGuard } from './auth.guard';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthGuard', () => {
  let guard: AuthGuard;

  beforeEach(() => {
    guard = new AuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should throw UnauthorizedException when handleRequest receives no user', () => {
    expect(() => guard.handleRequest(null, false)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when handleRequest receives an error', () => {
    const error = new Error('JWT verification failed');
    expect(() => guard.handleRequest(error, false)).toThrow();
  });

  it('should return user when handleRequest receives a valid user', () => {
    const user = {
      sub: 'user-123',
      email: 'test@example.com',
      name: 'Test',
      organizationId: 'org-456',
      role: 'OWNER' as const,
      iat: 1718000000,
      exp: 1718600000,
    };
    const result = guard.handleRequest(null, user);
    expect(result).toEqual(user);
  });
});
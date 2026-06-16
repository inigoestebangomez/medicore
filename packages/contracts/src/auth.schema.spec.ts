import { describe, it, expect } from 'vitest';
import {
  MemberRoleSchema,
  JwtPayloadSchema,
  UserProfileSchema,
  SwitchOrganizationSchema,
  AuthProfileSchema,
} from './auth.schema';

describe('auth.schema', () => {
  describe('MemberRoleSchema', () => {
    it('should accept valid roles', () => {
      expect(MemberRoleSchema.parse('OWNER')).toBe('OWNER');
      expect(MemberRoleSchema.parse('PHYSICIAN')).toBe('PHYSICIAN');
      expect(MemberRoleSchema.parse('VIEWER')).toBe('VIEWER');
      expect(MemberRoleSchema.parse('ADMIN')).toBe('ADMIN');
    });

    it('should reject invalid roles', () => {
      expect(() => MemberRoleSchema.parse('SUPERADMIN')).toThrow();
      expect(() => MemberRoleSchema.parse('')).toThrow();
      expect(() => MemberRoleSchema.parse(42)).toThrow();
    });
  });

  describe('JwtPayloadSchema', () => {
    const validPayload = {
      sub: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      name: 'Test User',
      organizationId: '660e8400-e29b-41d4-a716-446655440001',
      role: 'PHYSICIAN' as const,
      iat: 1718000000,
      exp: 1718600000,
    };

    it('should accept a valid JWT payload', () => {
      const result = JwtPayloadSchema.parse(validPayload);
      expect(result.sub).toBe(validPayload.sub);
      expect(result.role).toBe('PHYSICIAN');
    });

    it('should reject payload with missing fields', () => {
      const { sub, ...missingSub } = validPayload;
      expect(() => JwtPayloadSchema.parse(missingSub)).toThrow();
    });

    it('should reject payload with invalid email', () => {
      expect(() =>
        JwtPayloadSchema.parse({ ...validPayload, email: 'not-an-email' }),
      ).toThrow();
    });

    it('should reject payload with invalid role', () => {
      expect(() =>
        JwtPayloadSchema.parse({ ...validPayload, role: 'SUPERADMIN' }),
      ).toThrow();
    });

    it('should reject payload with non-UUID sub', () => {
      expect(() =>
        JwtPayloadSchema.parse({ ...validPayload, sub: 'not-a-uuid' }),
      ).toThrow();
    });
  });

  describe('UserProfileSchema', () => {
    const validProfile = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      name: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
      memberships: [
        {
          organizationId: '660e8400-e29b-41d4-a716-446655440001',
          organizationName: 'Test Org',
          role: 'OWNER',
        },
      ],
    };

    it('should accept a valid user profile', () => {
      const result = UserProfileSchema.parse(validProfile);
      expect(result.id).toBe(validProfile.id);
      expect(result.memberships).toHaveLength(1);
    });

    it('should accept profile without avatarUrl', () => {
      const { avatarUrl, ...noAvatar } = validProfile;
      const result = UserProfileSchema.parse(noAvatar);
      expect(result.avatarUrl).toBeUndefined();
    });

    it('should reject profile with invalid email', () => {
      expect(() =>
        UserProfileSchema.parse({ ...validProfile, email: 'bad' }),
      ).toThrow();
    });

    it('should reject empty memberships array with invalid role', () => {
      const invalid = {
        ...validProfile,
        memberships: [{ ...validProfile.memberships[0], role: 'HACKER' }],
      };
      expect(() => UserProfileSchema.parse(invalid)).toThrow();
    });
  });

  describe('SwitchOrganizationSchema', () => {
    it('should accept a valid organization ID', () => {
      const result = SwitchOrganizationSchema.parse({
        organizationId: '660e8400-e29b-41d4-a716-446655440001',
      });
      expect(result.organizationId).toBe(
        '660e8400-e29b-41d4-a716-446655440001',
      );
    });

    it('should reject a non-UUID organization ID', () => {
      expect(() =>
        SwitchOrganizationSchema.parse({ organizationId: 'not-a-uuid' }),
      ).toThrow();
    });
  });

  describe('AuthProfileSchema', () => {
    const validProfile = {
      email: 'user@google.com',
      name: 'Google User',
      avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
      oauthProvider: 'google' as const,
      oauthSub: '1234567890',
    };

    it('should accept a valid Google auth profile', () => {
      const result = AuthProfileSchema.parse(validProfile);
      expect(result.oauthProvider).toBe('google');
      expect(result.email).toBe('user@google.com');
    });

    it('should accept a valid Microsoft auth profile', () => {
      const msProfile = { ...validProfile, oauthProvider: 'microsoft' };
      const result = AuthProfileSchema.parse(msProfile);
      expect(result.oauthProvider).toBe('microsoft');
    });

    it('should reject invalid OAuth provider', () => {
      expect(() =>
        AuthProfileSchema.parse({ ...validProfile, oauthProvider: 'github' }),
      ).toThrow();
    });

    it('should accept profile without avatarUrl', () => {
      const { avatarUrl, ...noAvatar } = validProfile;
      const result = AuthProfileSchema.parse(noAvatar);
      expect(result.avatarUrl).toBeUndefined();
    });

    it('should reject profile with missing email', () => {
      const { email, ...missing } = validProfile;
      expect(() => AuthProfileSchema.parse(missing)).toThrow();
    });

    it('should reject profile with non-URL avatarUrl', () => {
      expect(() =>
        AuthProfileSchema.parse({ ...validProfile, avatarUrl: 'not-a-url' }),
      ).toThrow();
    });
  });
});
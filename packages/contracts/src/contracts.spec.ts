import { describe, it, expect } from 'vitest';
import {
  CreateOrganizationSchema,
  UpdateOrganizationSchema,
  InviteMemberSchema,
  UpdateMemberRoleSchema,
  AcceptInvitationSchema,
} from './index';

describe('organization.schema', () => {
  describe('CreateOrganizationSchema', () => {
    it('should accept valid organization creation data', () => {
      const result = CreateOrganizationSchema.parse({
        name: 'Clínica ORL',
        type: 'CLINIC',
      });
      expect(result.name).toBe('Clínica ORL');
      expect(result.type).toBe('CLINIC');
    });

    it('should reject name shorter than 2 chars', () => {
      expect(() => CreateOrganizationSchema.parse({ name: 'X', type: 'SOLO_PRACTICE' })).toThrow();
    });

    it('should reject invalid organization type', () => {
      expect(() => CreateOrganizationSchema.parse({ name: 'Test', type: 'INVALID' })).toThrow();
    });

    it('should accept optional logoUrl', () => {
      const result = CreateOrganizationSchema.parse({
        name: 'Test Org',
        type: 'HOSPITAL_DEPT',
        logoUrl: 'https://example.com/logo.png',
      });
      expect(result.logoUrl).toBe('https://example.com/logo.png');
    });
  });

  describe('UpdateOrganizationSchema', () => {
    it('should accept partial updates', () => {
      const result = UpdateOrganizationSchema.parse({ name: 'New Name' });
      expect(result.name).toBe('New Name');
    });

    it('should accept empty object (no changes)', () => {
      const result = UpdateOrganizationSchema.parse({});
      expect(result.name).toBeUndefined();
    });
  });
});

describe('member.schema', () => {
  describe('InviteMemberSchema', () => {
    it('should accept valid invitation data', () => {
      const result = InviteMemberSchema.parse({
        email: 'doctor@example.com',
        role: 'PHYSICIAN',
      });
      expect(result.email).toBe('doctor@example.com');
      expect(result.role).toBe('PHYSICIAN');
    });

    it('should reject invalid email', () => {
      expect(() => InviteMemberSchema.parse({ email: 'bad-email', role: 'VIEWER' })).toThrow();
    });

    it('should reject invalid role', () => {
      expect(() => InviteMemberSchema.parse({ email: 'a@b.com', role: 'SUPERADMIN' })).toThrow();
    });
  });

  describe('UpdateMemberRoleSchema', () => {
    it('should accept valid role update', () => {
      const result = UpdateMemberRoleSchema.parse({ role: 'ADMIN' });
      expect(result.role).toBe('ADMIN');
    });

    it('should reject invalid role', () => {
      expect(() => UpdateMemberRoleSchema.parse({ role: 'MANAGER' })).toThrow();
    });
  });
});

describe('invitation.schema', () => {
  describe('AcceptInvitationSchema', () => {
    it('should accept valid token', () => {
      const result = AcceptInvitationSchema.parse({ token: 'abc123def456' });
      expect(result.token).toBe('abc123def456');
    });

    it('should reject empty token', () => {
      expect(() => AcceptInvitationSchema.parse({ token: '' })).toThrow();
    });
  });
});
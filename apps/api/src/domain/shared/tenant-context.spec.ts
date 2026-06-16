// apps/api/src/domain/shared/tenant-context.spec.ts
import { TenantContextManager } from './tenant-context';

describe('TenantContextManager', () => {
  const ctx = {
    organizationId: 'org-123',
    userId: 'user-456',
    role: 'OWNER' as const,
  };

  it('should retrieve organizationId from an active context', async () => {
    await TenantContextManager.run(ctx, async () => {
      expect(TenantContextManager.getOrganizationId()).toBe('org-123');
    });
  });

  it('should retrieve userId from an active context', async () => {
    await TenantContextManager.run(ctx, async () => {
      expect(TenantContextManager.getUserId()).toBe('user-456');
    });
  });

  it('should retrieve role from an active context', async () => {
    await TenantContextManager.run(ctx, async () => {
      expect(TenantContextManager.getRole()).toBe('OWNER');
    });
  });

  it('should throw when no active context for getOrganizationId', () => {
    expect(() => TenantContextManager.getOrganizationId()).toThrow(
      'TenantContext: no active context',
    );
  });

  it('should throw when no active context for getUserId', () => {
    expect(() => TenantContextManager.getUserId()).toThrow(
      'TenantContext: no active context',
    );
  });

  it('should throw when no active context for getRole', () => {
    expect(() => TenantContextManager.getRole()).toThrow(
      'TenantContext: no active context',
    );
  });

  it('should return undefined from getContext when no active context', () => {
    expect(TenantContextManager.getContext()).toBeUndefined();
  });

  it('should return context from getContext when active', async () => {
    await TenantContextManager.run(ctx, async () => {
      expect(TenantContextManager.getContext()).toEqual(ctx);
    });
  });

  it('should work with runSync', () => {
    const result = TenantContextManager.runSync(ctx, () => {
      return TenantContextManager.getOrganizationId();
    });
    expect(result).toBe('org-123');
  });
});
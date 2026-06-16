// apps/api/src/api/shared/guards/rbac.guard.spec.ts
import { RBACGuard } from './rbac.guard';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContextManager } from '@/domain/shared/tenant-context';
import { Action } from '@/domain/shared/rbac-permissions';

// Helper to create a mock ExecutionContext
function createMockContext(handler: (...args: unknown[]) => unknown): any {
  return {
    getHandler: () => handler,
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({}),
    }),
  };
}

describe('RBACGuard', () => {
  let guard: RBACGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RBACGuard(reflector);
  });

  it('should allow access when no action is required', () => {
    const handler = function noActionRequired() {};
    reflector.get = jest.fn().mockReturnValue(undefined);

    const ctx = createMockContext(handler);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow OWNER to perform MANAGE_MEMBERS', async () => {
    await TenantContextManager.run(
      { organizationId: 'org-1', userId: 'user-1', role: 'OWNER' },
      async () => {
        const handler = function manageMembers() {};
        reflector.get = jest.fn().mockReturnValue(Action.MANAGE_MEMBERS);

        const ctx = createMockContext(handler);
        expect(guard.canActivate(ctx)).toBe(true);
      },
    );
  });

  it('should deny VIEWER from performing CREATE_PATIENT', async () => {
    await TenantContextManager.run(
      { organizationId: 'org-1', userId: 'user-1', role: 'VIEWER' },
      async () => {
        const handler = function createPatient() {};
        reflector.get = jest.fn().mockReturnValue(Action.CREATE_PATIENT);

        const ctx = createMockContext(handler);
        expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
      },
    );
  });

  it('should deny PHYSICIAN from performing MANAGE_MEMBERS', async () => {
    await TenantContextManager.run(
      { organizationId: 'org-1', userId: 'user-1', role: 'PHYSICIAN' },
      async () => {
        const handler = function manageMembers() {};
        reflector.get = jest.fn().mockReturnValue(Action.MANAGE_MEMBERS);

        const ctx = createMockContext(handler);
        expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
      },
    );
  });

  it('should throw ForbiddenException when no tenant context exists', () => {
    const handler = function someAction() {};
    reflector.get = jest.fn().mockReturnValue(Action.CREATE_PATIENT);

    const ctx = createMockContext(handler);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
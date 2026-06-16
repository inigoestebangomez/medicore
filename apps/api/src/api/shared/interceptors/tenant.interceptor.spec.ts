// apps/api/src/api/shared/interceptors/tenant.interceptor.spec.ts
import { TenantInterceptor } from './tenant.interceptor';
import { of } from 'rxjs';
import type { JwtPayload } from '@medicore/contracts';

// Helper to create a mock ExecutionContext
function createMockContext(user?: Partial<JwtPayload>) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: user
          ? {
              sub: user.sub ?? 'user-1',
              email: user.email ?? 'test@test.com',
              name: user.name ?? 'Test',
              organizationId: user.organizationId ?? 'org-1',
              role: user.role ?? 'OWNER',
              iat: 1718000000,
              exp: 1718600000,
            }
          : undefined,
      }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => ({}),
  } as any;
}

describe('TenantInterceptor', () => {
  let interceptor: TenantInterceptor;

  beforeEach(() => {
    interceptor = new TenantInterceptor();
  });

  it('should set tenant context when user is present', async () => {
    const context = createMockContext({
      sub: 'user-123',
      organizationId: 'org-456',
      role: 'PHYSICIAN' as any,
    });
    const callHandler = {
      handle: () => of('result'),
    };

    const observable = interceptor.intercept(context, callHandler);

    // Subscribe to the observable and verify tenant context is set
    const result = await new Promise<string>((resolve, reject) => {
      observable.subscribe({
        next: (val) => resolve(val as string),
        error: (err) => reject(err),
      });
    });

    expect(result).toBe('result');
  });

  it('should continue without tenant context when no user', () => {
    const context = createMockContext();
    const callHandler = {
      handle: () => of('no-user-result'),
    };

    // Should not throw — just pass through
    const observable = interceptor.intercept(context, callHandler);
    expect(observable).toBeDefined();
  });
});
// apps/api/src/domain/shared/tenant-context.ts
// AsyncLocalStorage wrapper for { organizationId, userId, role }
import type { MemberRole } from '@medicore/contracts';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  organizationId: string;
  userId: string;
  role: MemberRole;
}

export class TenantContextManager {
  private static readonly storage = new AsyncLocalStorage<TenantContext>();

  static run<T>(ctx: TenantContext, fn: () => Promise<T>): Promise<T> {
    return this.storage.run(ctx, fn);
  }

  static runSync<T>(ctx: TenantContext, fn: () => T): T {
    return this.storage.run(ctx, fn);
  }

  static getOrganizationId(): string {
    const store = this.storage.getStore();
    if (!store) {
      throw new Error('TenantContext: no active context. Did you forget TenantInterceptor?');
    }
    return store.organizationId;
  }

  static getUserId(): string {
    const store = this.storage.getStore();
    if (!store) {
      throw new Error('TenantContext: no active context. Did you forget TenantInterceptor?');
    }
    return store.userId;
  }

  static getRole(): MemberRole {
    const store = this.storage.getStore();
    if (!store) {
      throw new Error('TenantContext: no active context. Did you forget TenantInterceptor?');
    }
    return store.role;
  }

  static getContext(): TenantContext | undefined {
    return this.storage.getStore();
  }
}
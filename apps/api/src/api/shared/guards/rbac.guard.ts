// apps/api/src/api/shared/guards/rbac.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContextManager } from '@/domain/shared/tenant-context';
import { hasPermission, Action } from '@/domain/shared/rbac-permissions';

export const REQUIRED_ACTION_KEY = 'requiredAction';

@Injectable()
export class RBACGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAction = this.reflector.get<Action>(
      REQUIRED_ACTION_KEY,
      context.getHandler(),
    );

    if (!requiredAction) {
      // No action required = allow all authenticated users
      return true;
    }

    const ctx = TenantContextManager.getContext();
    if (!ctx) {
      throw new ForbiddenException('No tenant context found');
    }

    if (!hasPermission(ctx.role, requiredAction)) {
      throw new ForbiddenException(
        `Role '${ctx.role}' does not have permission for '${requiredAction}'`,
      );
    }

    return true;
  }
}
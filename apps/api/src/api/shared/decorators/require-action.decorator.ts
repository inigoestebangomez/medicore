// apps/api/src/api/shared/decorators/require-action.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import type { Action } from '@/domain/shared/rbac-permissions';

export const RequireAction = (action: Action) =>
  SetMetadata(REQUIRED_ACTION_KEY, action);
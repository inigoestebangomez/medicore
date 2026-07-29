// apps/api/src/infrastructure/config/feature-flag.guard.ts
// NestJS guard that checks a feature flag before allowing access to a
// controller or handler. Set the required flag via @SetMetadata.
//
// Usage:
//   @RequireFeature('RESEARCH_V2_DASHBOARDS')
//   @Controller('research/dashboards')
//   export class DashboardController { ... }

import { Injectable, CanActivate, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService, type ResearchV2Flag } from './feature-flags.service';

export const FEATURE_FLAG_KEY = 'feature_flag';

export const RequireFeature = (flag: ResearchV2Flag) =>
  SetMetadata(FEATURE_FLAG_KEY, flag);

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly flags: FeatureFlagsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredFlag = this.reflector.getAllAndOverride<ResearchV2Flag>(FEATURE_FLAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredFlag) return true; // no flag required → allow
    this.flags.require(requiredFlag);
    return true;
  }
}

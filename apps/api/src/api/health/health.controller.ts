// apps/api/src/api/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { SkipSubscriptionCheck } from '@/api/shared/decorators/skip-subscription.decorator';

@SkipSubscriptionCheck()
@Controller()
export class HealthController {
  @Get()
  health() {
    return { status: 'ok' };
  }
}
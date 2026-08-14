// apps/api/src/api/calendar/calendar-sync.controller.ts
import { Controller, Get, Post, Delete, Param, UseGuards, Inject, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type { JwtPayload } from '@medicore/contracts';
import { CalendarSyncService } from '@/infrastructure/calendar/calendar-sync.service';
import { CalendarProviderAdapter } from '@/infrastructure/calendar/providers/calendar-provider.interface';

@Controller('calendar/sync')
@UseGuards(AuthGuard, RBACGuard)
export class CalendarSyncController {
  constructor(
    private readonly syncService: CalendarSyncService,
    @Inject('CALENDAR_PROVIDERS') private readonly providers: CalendarProviderAdapter[],
  ) {}

  @Get('providers')
  async listProviders(@CurrentUser() user: JwtPayload) {
    const statuses = await Promise.all(
      this.providers.map(async (p) => ({
        provider: p.provider,
        connected: await p.isConnected(user.sub),
      })),
    );
    return { providers: statuses };
  }

  @Post('connect/:provider')
  async connect(@Param('provider') provider: string, @CurrentUser() user: JwtPayload) {
    const adapter = this.providers.find((p) => p.provider === provider);
    if (!adapter) throw new Error(`Unknown provider: ${provider}`);
    const authUrl = await adapter.getAuthorizationUrl(user.sub);
    return { authUrl };
  }

  @Post('callback/:provider')
  async callback(
    @Param('provider') _provider: string,
  ) {
    return { message: 'Callback endpoint registered — handle via frontend redirect' };
  }

  @Delete('disconnect/:provider')
  @HttpCode(HttpStatus.OK)
  async disconnect(@Param('provider') provider: string, @CurrentUser() user: JwtPayload) {
    const adapter = this.providers.find((p) => p.provider === provider);
    if (!adapter) throw new Error(`Unknown provider: ${provider}`);
    await adapter.disconnect?.(user.sub);
    return { message: 'Disconnected' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@CurrentUser() user: JwtPayload) {
    await this.syncService.refreshUser(user.sub);
    return { message: 'Sync triggered' };
  }
}

// apps/api/src/api/schedule/schedule.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type { JwtPayload } from '@medicore/contracts';
import type { IDoctorScheduleRepository } from '@/domain/schedule/schedule.repository.interface';
import { Action } from '@/domain/shared/rbac-permissions';
import { ZodValidationPipe } from '@/api/shared/pipes/zod-validation.pipe';
import { UpsertScheduleSchema, ListScheduleQuerySchema } from './dto/schedule.dto';

@Controller('schedule')
@UseGuards(AuthGuard, RBACGuard)
export class ScheduleController {
  constructor(
    @Inject('IDoctorScheduleRepository') private readonly scheduleRepo: IDoctorScheduleRepository,
  ) {}

  @Get()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.SCHEDULE_MANAGE)
  async list(@Query() query: any, @CurrentUser() user: JwtPayload) {
    const parsed = ListScheduleQuerySchema.parse(query);
    const userId = parsed.userId ?? user.sub;
    const items = await this.scheduleRepo.listByUser(user.organizationId, userId);
    return {
      items: items.map((s) => this.toResponse(s)),
      userId,
    };
  }

  @Post()
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.SCHEDULE_MANAGE)
  async upsert(
    @Body(new ZodValidationPipe(UpsertScheduleSchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    const schedule = await this.scheduleRepo.upsert({
      organizationId: user.organizationId,
      userId: body.userId,
      dayOfWeek: body.dayOfWeek,
      startTime: body.startTime,
      endTime: body.endTime,
      slotDuration: body.slotDuration,
    });
    return this.toResponse(schedule);
  }

  @Delete(':id')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.SCHEDULE_MANAGE)
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.scheduleRepo.delete(id, user.organizationId);
    return { id };
  }

  private toResponse(s: any) {
    return {
      id: s.id,
      organizationId: s.organizationId,
      userId: s.userId,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      slotDuration: s.slotDuration,
      isActive: s.isActive,
    };
  }
}
// apps/api/src/api/calendar/calendar.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Inject, NotFoundException, ForbiddenException,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import type { JwtPayload } from '@medicore/contracts';
import type { ICalendarEventRepository } from '@/domain/calendar/calendar-event.repository.interface';
import { CreateCalendarEventUseCase } from '@/application/calendar/commands/create-calendar-event.use-case';
import { UpdateCalendarEventUseCase } from '@/application/calendar/commands/update-calendar-event.use-case';
import { DeleteCalendarEventUseCase } from '@/application/calendar/commands/delete-calendar-event.use-case';
import { CalendarSourceMapperService } from '@/infrastructure/calendar/calendar-source-mapper.service';
import { ZodValidationPipe } from '@/api/shared/pipes/zod-validation.pipe';
import {
  CreateCalendarEventSchema,
  UpdateCalendarEventSchema,
  ListCalendarEventsQuerySchema,
} from '@medicore/contracts';

@Controller('calendar/events')
@UseGuards(AuthGuard, RBACGuard)
export class CalendarController {
  private readonly createUseCase: CreateCalendarEventUseCase;
  private readonly updateUseCase: UpdateCalendarEventUseCase;
  private readonly deleteUseCase: DeleteCalendarEventUseCase;

  constructor(
    @Inject('ICalendarEventRepository') calendarRepo: ICalendarEventRepository,
    private readonly sourceMapper: CalendarSourceMapperService,
  ) {
    this.createUseCase = new CreateCalendarEventUseCase(calendarRepo);
    this.updateUseCase = new UpdateCalendarEventUseCase(calendarRepo);
    this.deleteUseCase = new DeleteCalendarEventUseCase(calendarRepo);
  }

  @Get()
  async list(
    @Query(new ZodValidationPipe(ListCalendarEventsQuerySchema)) query: any,
    @CurrentUser() user: JwtPayload,
  ) {
    const from = new Date(query.from);
    const to = new Date(query.to);

    return this.sourceMapper.listMergedEvents({
      userId: user.sub,
      organizationId: user.organizationId,
      from,
      to,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(CreateCalendarEventSchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.createUseCase.execute({
      organizationId: user.organizationId,
      userId: user.sub,
      title: body.title,
      description: body.description,
      startDateTime: new Date(body.startDateTime),
      endDateTime: new Date(body.endDateTime),
      isPublic: body.isPublic,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
    });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCalendarEventSchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      return await this.updateUseCase.execute({
        id,
        organizationId: user.organizationId,
        userId: user.sub,
        title: body.title,
        description: body.description,
        startDateTime: body.startDateTime ? new Date(body.startDateTime) : undefined,
        endDateTime: body.endDateTime ? new Date(body.endDateTime) : undefined,
        status: body.status,
        isPublic: body.isPublic,
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      throw error;
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      return await this.deleteUseCase.execute({
        id,
        organizationId: user.organizationId,
        userId: user.sub,
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      throw error;
    }
  }
}

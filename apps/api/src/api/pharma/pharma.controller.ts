// apps/api/src/api/pharma/pharma.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
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
import type { IPharmaRepository } from '@/domain/pharma/pharma.repository.interface';
import { Action } from '@/domain/shared/rbac-permissions';
import { ZodValidationPipe } from '@/api/shared/pipes/zod-validation.pipe';
import {
  CreateContactSchema,
  UpdateContactSchema,
  CreateInteractionSchema,
  ListContactsQuerySchema,
} from './dto/pharma.dto';

@Controller('pharma')
@UseGuards(AuthGuard, RBACGuard)
export class PharmaController {
  constructor(
    @Inject('IPharmaRepository') private readonly pharmaRepo: IPharmaRepository,
  ) {}

  @Get('contacts')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.PHARMA_READ)
  async listContacts(@Query() query: any, @CurrentUser() user: JwtPayload) {
    const parsed = ListContactsQuerySchema.parse(query);
    const result = await this.pharmaRepo.listContacts({
      organizationId: user.organizationId,
      page: parsed.page,
      pageSize: parsed.pageSize,
      company: parsed.company,
    });
    return {
      items: result.items.map((c) => this.toContact(c)),
      total: result.total,
      page: parsed.page,
      pageSize: parsed.pageSize,
    };
  }

  @Post('contacts')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.PHARMA_MANAGE)
  async createContact(
    @Body(new ZodValidationPipe(CreateContactSchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    const contact = await this.pharmaRepo.createContact({
      organizationId: user.organizationId,
      name: body.name,
      company: body.company,
      role: body.role ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      notes: body.notes ?? null,
      nextFollowUpAt: body.nextFollowUpAt ? new Date(body.nextFollowUpAt) : null,
    });
    return this.toContact(contact);
  }

  @Put('contacts/:id')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.PHARMA_MANAGE)
  async updateContact(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateContactSchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    const contact = await this.pharmaRepo.updateContact(id, user.organizationId, {
      ...body,
      nextFollowUpAt: body.nextFollowUpAt ? new Date(body.nextFollowUpAt) : undefined,
      lastContactAt: body.lastContactAt ? new Date(body.lastContactAt) : undefined,
    });
    return this.toContact(contact);
  }

  @Delete('contacts/:id')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.PHARMA_MANAGE)
  async deleteContact(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.pharmaRepo.deleteContact(id, user.organizationId);
    return { id };
  }

  @Get('contacts/:id/interactions')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.PHARMA_READ)
  async listInteractions(
    @Param('id') contactId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const interactions = await this.pharmaRepo.listInteractions(user.organizationId, contactId);
    return {
      items: interactions.map((i) => this.toInteraction(i)),
    };
  }

  @Post('contacts/:id/interactions')
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.PHARMA_MANAGE)
  async createInteraction(
    @Param('id') contactId: string,
    @Body(new ZodValidationPipe(CreateInteractionSchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    const interaction = await this.pharmaRepo.createInteraction({
      organizationId: user.organizationId,
      contactId,
      type: body.type,
      notes: body.notes ?? null,
      followUpNeeded: body.followUpNeeded ?? false,
      date: body.date ? new Date(body.date) : undefined,
    });
    return this.toInteraction(interaction);
  }

  private toContact(c: any) {
    return {
      id: c.id,
      organizationId: c.organizationId,
      name: c.name,
      company: c.company,
      role: c.role,
      email: c.email,
      phone: c.phone,
      notes: c.notes,
      lastContactAt: c.lastContactAt ? (c.lastContactAt instanceof Date ? c.lastContactAt.toISOString() : c.lastContactAt) : null,
      nextFollowUpAt: c.nextFollowUpAt ? (c.nextFollowUpAt instanceof Date ? c.nextFollowUpAt.toISOString() : c.nextFollowUpAt) : null,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
    };
  }

  private toInteraction(i: any) {
    return {
      id: i.id,
      organizationId: i.organizationId,
      contactId: i.contactId,
      date: i.date instanceof Date ? i.date.toISOString() : i.date,
      type: i.type,
      notes: i.notes,
      followUpNeeded: i.followUpNeeded,
      createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : i.createdAt,
    };
  }
}
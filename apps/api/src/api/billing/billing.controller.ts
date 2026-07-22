// apps/api/src/api/billing/billing.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  Inject,
  HttpCode,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { RBACGuard } from '@/api/shared/guards/rbac.guard';
import { REQUIRED_ACTION_KEY } from '@/api/shared/guards/rbac.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import { SkipSubscriptionCheck } from '@/api/shared/decorators/skip-subscription.decorator';
import { ZodValidationPipe } from '@/api/shared/pipes/zod-validation.pipe';
import { CreateCheckoutSchema } from '@medicore/contracts';
import type { JwtPayload } from '@medicore/contracts';
import type { IOrganizationRepository } from '@/domain/organization/organization.repository.interface';
import type { IProcessedStripeEventRepository } from '@/domain/billing/stripe-event.repository.interface';
import type { IAiReportUsageRepository } from '@/domain/billing/ai-report-usage.repository.interface';
import type { IBillingTransactionRepository } from '@/domain/billing/billing-transaction.repository.interface';
import { Action } from '@/domain/shared/rbac-permissions';
import {
  CreateBillingTransactionSchema,
  ListBillingTransactionsQuerySchema,
} from './dto/billing-transaction.dto';
import { StripeService } from '@/infrastructure/billing/stripe.service';
import { CreateCheckoutUseCase } from '@/application/billing/commands/create-checkout.use-case';
import { CreatePortalUseCase } from '@/application/billing/commands/create-portal.use-case';
import { HandleStripeWebhookUseCase } from '@/application/billing/commands/handle-stripe-webhook.use-case';
import { GetCurrentUsageUseCase } from '@/application/billing/queries/get-current-usage.use-case';
import { BillingInterval } from '@/domain/organization/organization.types';
import { SubscriptionAlreadyActiveError } from '@/domain/billing/errors/subscription-already-active.error';
import { StripeCustomerMissingError } from '@/domain/billing/errors/stripe-customer-missing.error';
import { StripeSignatureInvalidError } from '@/domain/billing/errors/stripe-signature-invalid.error';

@Controller('billing')
export class BillingController {
  private readonly checkoutUseCase: CreateCheckoutUseCase;
  private readonly portalUseCase: CreatePortalUseCase;
  private readonly webhookUseCase: HandleStripeWebhookUseCase;
  private readonly usageUseCase: GetCurrentUsageUseCase;
  private readonly transactionRepo: IBillingTransactionRepository;

  constructor(
    @Inject('IOrganizationRepository') orgRepo: IOrganizationRepository,
    @Inject('IProcessedStripeEventRepository') eventRepo: IProcessedStripeEventRepository,
    @Inject('IAiReportUsageRepository') usageRepo: IAiReportUsageRepository,
    @Inject('IBillingTransactionRepository') transactionRepo: IBillingTransactionRepository,
    private readonly stripeService: StripeService, // value import — reflect-metadata token
  ) {
    this.checkoutUseCase = new CreateCheckoutUseCase(orgRepo, stripeService);
    this.portalUseCase = new CreatePortalUseCase(orgRepo, stripeService);
    this.webhookUseCase = new HandleStripeWebhookUseCase(eventRepo, orgRepo);
    this.usageUseCase = new GetCurrentUsageUseCase(orgRepo, usageRepo);
    this.transactionRepo = transactionRepo;
  }

  // ─────────────────────────────────────────────
  // Billing transactions (clinical/financial)
  // ─────────────────────────────────────────────

  @Get('transactions')
  @UseGuards(AuthGuard, RBACGuard)
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.BILLING_READ)
  async listTransactions(
    @Query() query: any,
    @CurrentUser() user: JwtPayload,
  ) {
    const parsed = ListBillingTransactionsQuerySchema.parse(query);
    const result = await this.transactionRepo.list({
      organizationId: user.organizationId,
      page: parsed.page,
      pageSize: parsed.pageSize,
      type: parsed.type,
      status: parsed.status,
      from: parsed.from ? new Date(parsed.from) : undefined,
      to: parsed.to ? new Date(parsed.to) : undefined,
    });

    return {
      items: result.items.map((t) => this.toTransactionResponse(t)),
      total: result.total,
      page: parsed.page,
      pageSize: parsed.pageSize,
    };
  }

  @Post('transactions')
  @UseGuards(AuthGuard, RBACGuard)
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.BILLING_WRITE)
  async createTransaction(
    @Body(new ZodValidationPipe(CreateBillingTransactionSchema)) body: any,
    @CurrentUser() user: JwtPayload,
  ) {
    const tx = await this.transactionRepo.create({
      organizationId: user.organizationId,
      patientId: body.patientId ?? null,
      consultationId: body.consultationId ?? null,
      surgeryId: body.surgeryId ?? null,
      amount: body.amount,
      type: body.type,
      status: body.status,
      description: body.description ?? null,
      date: body.date ? new Date(body.date) : undefined,
    });
    return this.toTransactionResponse(tx);
  }

  @Get('stats')
  @UseGuards(AuthGuard, RBACGuard)
  @Reflect.metadata(REQUIRED_ACTION_KEY, Action.BILLING_READ)
  async getStats(@CurrentUser() user: JwtPayload) {
    const stats = await this.transactionRepo.getStats(user.organizationId);
    return { data: stats };
  }

  private toTransactionResponse(t: any) {
    return {
      id: t.id,
      organizationId: t.organizationId,
      patientId: t.patientId,
      consultationId: t.consultationId,
      surgeryId: t.surgeryId,
      amount: t.amount,
      type: t.type,
      status: t.status,
      description: t.description,
      date: t.date instanceof Date ? t.date.toISOString() : t.date,
      createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
      updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : t.updatedAt,
    };
  }

  @Post('checkout')
  @SkipSubscriptionCheck()
  @UseGuards(AuthGuard)
  async createCheckout(
    @Body(new ZodValidationPipe(CreateCheckoutSchema))
    body: { billingInterval: 'MONTHLY' | 'YEARLY' },
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.checkoutUseCase.execute({
        organizationId: user.organizationId,
        billingInterval: body.billingInterval as BillingInterval,
        customerEmail: user.email ?? user.sub,
      });
      return { data: { url: result.url, sessionId: result.sessionId } };
    } catch (error) {
      this.mapCheckoutError(error);
    }
  }

  @Post('portal')
  @SkipSubscriptionCheck()
  @UseGuards(AuthGuard)
  async createPortal(@CurrentUser() user: JwtPayload) {
    try {
      const result = await this.portalUseCase.execute({
        organizationId: user.organizationId,
      });
      return { data: { url: result.url } };
    } catch (error) {
      if (error instanceof StripeCustomerMissingError) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'STRIPE_CUSTOMER_MISSING',
          message: error.message,
        });
      }
      throw error;
    }
  }

  @Post('webhook')
  @SkipSubscriptionCheck()
  @HttpCode(200)
  async webhook(@Req() req: Request) {
    // rawBody is populated by Express when `rawBody: true` is set in main.ts.
    const raw = (req as any).rawBody;
    if (!raw) {
      throw new BadRequestException('Missing raw request body');
    }
    const signature = req.headers['stripe-signature'] as string | undefined;

    let event;
    try {
      event = this.stripeService.constructEvent(raw, signature);
    } catch (error) {
      if (error instanceof StripeSignatureInvalidError) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'STRIPE_SIGNATURE_INVALID',
          message: error.message,
        });
      }
      throw error;
    }

    const result = await this.webhookUseCase.execute(event);
    return {
      received: true,
      eventId: result.eventId,
      eventType: result.eventType,
      duplicated: result.duplicated,
    };
  }

  @Get('usage')
  @UseGuards(AuthGuard)
  async getUsage(@CurrentUser() user: JwtPayload) {
    const usage = await this.usageUseCase.execute({
      organizationId: user.organizationId,
    });
    return { data: usage };
  }

  private mapCheckoutError(error: unknown): never {
    if (error instanceof SubscriptionAlreadyActiveError) {
      throw new ConflictException({
        statusCode: 409,
        code: 'SUBSCRIPTION_ALREADY_ACTIVE',
        message: error.message,
      });
    }
    throw error;
  }
}
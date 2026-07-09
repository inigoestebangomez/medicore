// apps/api/src/api/billing/billing.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  Inject,
  HttpCode,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@/api/shared/guards/auth.guard';
import { CurrentUser } from '@/api/shared/decorators/current-user.decorator';
import { SkipSubscriptionCheck } from '@/api/shared/decorators/skip-subscription.decorator';
import { ZodValidationPipe } from '@/api/shared/pipes/zod-validation.pipe';
import { CreateCheckoutSchema } from '@medicore/contracts';
import type { JwtPayload } from '@medicore/contracts';
import type { IOrganizationRepository } from '@/domain/organization/organization.repository.interface';
import type { IProcessedStripeEventRepository } from '@/domain/billing/stripe-event.repository.interface';
import { StripeService } from '@/infrastructure/billing/stripe.service';
import { CreateCheckoutUseCase } from '@/application/billing/commands/create-checkout.use-case';
import { CreatePortalUseCase } from '@/application/billing/commands/create-portal.use-case';
import { HandleStripeWebhookUseCase } from '@/application/billing/commands/handle-stripe-webhook.use-case';
import { BillingInterval, PlanType } from '@/domain/organization/organization.types';
import { getLimit } from '@/domain/billing/plan.config';
import { getCurrentYearMonth } from '@/domain/billing/year-month';
import { SubscriptionAlreadyActiveError } from '@/domain/billing/errors/subscription-already-active.error';
import { StripeCustomerMissingError } from '@/domain/billing/errors/stripe-customer-missing.error';
import { StripeSignatureInvalidError } from '@/domain/billing/errors/stripe-signature-invalid.error';

@Controller('billing')
export class BillingController {
  private readonly checkoutUseCase: CreateCheckoutUseCase;
  private readonly portalUseCase: CreatePortalUseCase;
  private readonly webhookUseCase: HandleStripeWebhookUseCase;

  constructor(
    @Inject('IOrganizationRepository') private readonly orgRepo: IOrganizationRepository,
    @Inject('IProcessedStripeEventRepository') eventRepo: IProcessedStripeEventRepository,
    private readonly stripeService: StripeService,
  ) {
    this.checkoutUseCase = new CreateCheckoutUseCase(orgRepo, stripeService);
    this.portalUseCase = new CreatePortalUseCase(orgRepo, stripeService);
    this.webhookUseCase = new HandleStripeWebhookUseCase(eventRepo, orgRepo);
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
    // Phase 2 stub: returns current plan limit and a 0 usage count. The real
    // AiReportUsage count is wired in Phase 3 (GetCurrentUsageUseCase).
    const org = await this.orgRepo.findById(user.organizationId);
    const plan: PlanType = org?.plan ?? PlanType.FREE;
    return {
      data: {
        aiReportsGenerated: 0,
        planLimit: getLimit(plan),
        yearMonth: getCurrentYearMonth(),
        plan,
      },
    };
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
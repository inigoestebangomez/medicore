import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { PrismaService } from '@/infrastructure/database/prisma.service';

export const SKIP_SUBSCRIPTION_CHECK = 'SKIP_SUBSCRIPTION_CHECK';

@Injectable()
export class SubscriptionInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_SUBSCRIPTION_CHECK, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return next.handle();

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.organizationId) return next.handle();

    const url = request.url ?? '';
    if (
      url.startsWith('/auth') ||
      url === '/' ||
      url.startsWith('/health') ||
      url.startsWith('/v1/health')
    ) {
      return next.handle();
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        name: true,
      },
    });

    if (!org) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    const status = org.subscriptionStatus;

    if (status === 'ACTIVE' || status === 'TRIALING') {
      if (org.subscriptionExpiresAt && new Date(org.subscriptionExpiresAt) < new Date()) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            message: `Subscription for "${org.name}" has expired. Please renew to continue.`,
            code: 'SUBSCRIPTION_EXPIRED',
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      return next.handle();
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        message: `Subscription for "${org.name}" is ${status.toLowerCase()}. Please update your payment method.`,
        code: 'SUBSCRIPTION_REQUIRED',
        subscriptionStatus: status,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}

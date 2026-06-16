// apps/api/src/api/shared/interceptors/tenant.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextManager } from '@/domain/shared/tenant-context';
import type { JwtPayload } from '@medicore/contracts';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    if (user?.organizationId && user?.sub && user?.role) {
      return new Observable((subscriber) => {
        TenantContextManager.run(
          {
            organizationId: user.organizationId,
            userId: user.sub,
            role: user.role,
          },
          async () => {
            try {
              const result = await next.handle().toPromise();
              subscriber.next(result);
              subscriber.complete();
            } catch (err) {
              subscriber.error(err);
            }
          },
        );
      });
    }

    // No user context — continue without tenant context
    return next.handle();
  }
}
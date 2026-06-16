// apps/api/src/api/shared/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '@medicore/contracts';

export const CurrentUser = createParamDecorator(
  (_data: keyof JwtPayload | undefined, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtPayload;
  },
);
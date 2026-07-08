// apps/api/src/infrastructure/auth/jwt.strategy.ts
import { Strategy } from 'passport-jwt';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import type { JwtPayload } from '@medicore/contracts';

/**
 * Try multiple sources for the JWT:
 * 1. medicore-session cookie (browser requests)
 * 2. Authorization: Bearer header (server-to-server calls)
 */
const extractJwtFromRequest = (req: Request): string | null => {
  // Cookie
  if (req?.cookies?.['medicore-session']) {
    return req.cookies['medicore-session'];
  }
  // Bearer token
  const authHeader = req?.headers?.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: extractJwtFromRequest,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    return payload;
  }
}

// Export for testing
export { extractJwtFromRequest as extractJwtFromCookie };
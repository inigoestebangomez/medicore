// apps/api/src/infrastructure/auth/jwt.strategy.ts
import { Strategy } from 'passport-jwt';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import type { JwtPayload } from '@medicore/contracts';

/**
 * Custom extractor that reads the JWT from the 'medicore-session' cookie.
 * passport-jwt does not ship with fromCookie — we implement it manually.
 */
const extractJwtFromCookie = (req: Request): string | null => {
  if (req?.cookies?.['medicore-session']) {
    return req.cookies['medicore-session'];
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: extractJwtFromCookie,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    return payload;
  }
}

// Export for testing
export { extractJwtFromCookie };
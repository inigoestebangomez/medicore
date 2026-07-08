// apps/api/src/api/shared/interceptors/response-wrapper.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Wraps all successful API responses in { data: ... } for consistent
 * frontend consumption. Skips responses that already have a top-level
 * 'data' key to avoid double-wrapping.
 */
@Injectable()
export class ResponseWrapperInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((response) => {
        // Skip wrapping if already has a top-level 'data' key
        if (response && typeof response === 'object' && 'data' in response) {
          return response;
        }
        return { data: response };
      }),
    );
  }
}

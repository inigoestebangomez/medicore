// apps/api/src/infrastructure/stats/circuit-breaker.ts
// Circuit breaker for the Python stats microservice (design: 3 failures/60s →
// open, half-open after 30s). Prevents cascading failures when Python is down;
// callers fall back to descriptive stats + a "stats unavailable" warning.

import { Injectable } from '@nestjs/common';

export type CircuitState = 'closed' | 'open' | 'half_open';

const FAILURE_THRESHOLD = 3;
const OPEN_WINDOW_MS = 60_000; // remember failures for 60s
const HALF_OPEN_AFTER_MS = 30_000; // allow a probe after 30s open

@Injectable()
export class CircuitBreaker {
  private failures: number[] = []; // timestamps of recent failures
  private openedAt = 0;
  state: CircuitState = 'closed';

  private prune(now: number): void {
    this.failures = this.failures.filter((t) => now - t < OPEN_WINDOW_MS);
  }

  /** Whether a call is permitted right now. */
  allowCall(): boolean {
    const now = Date.now();
    if (this.state === 'open') {
      if (now - this.openedAt >= HALF_OPEN_AFTER_MS) {
        this.state = 'half_open';
        return true;
      }
      return false;
    }
    return true;
  }

  /** Record a successful call — closes the breaker from half-open. */
  recordSuccess(): void {
    if (this.state === 'half_open') {
      this.state = 'closed';
      this.openedAt = 0;
    }
    this.failures = [];
  }

  /** Record a failure — may trip the breaker to open. */
  recordFailure(): void {
    const now = Date.now();
    this.failures.push(now);
    this.prune(now);
    if (this.state === 'half_open' || this.failures.length >= FAILURE_THRESHOLD) {
      this.state = 'open';
      this.openedAt = now;
    }
  }

  /** Force reset (test helper). */
  reset(): void {
    this.failures = [];
    this.openedAt = 0;
    this.state = 'closed';
  }
}
// apps/api/src/infrastructure/stats/circuit-breaker.spec.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import { CircuitBreaker } from './circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;
  beforeEach(() => {
    breaker = new CircuitBreaker();
  });

  it('starts closed and allows calls', () => {
    expect(breaker.state).toBe('closed');
    expect(breaker.allowCall()).toBe(true);
  });

  it('opens after 3 failures within 60s', () => {
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.state).toBe('closed');
    breaker.recordFailure();
    expect(breaker.state).toBe('open');
    expect(breaker.allowCall()).toBe(false); // rejects during open
  });

  it('allows a probe after the 30s cooldown (half-open)', () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.state).toBe('open');

    // simulate 31s elapsed by rewinding the openedAt timestamp
    (breaker as any).openedAt = Date.now() - 31_000;
    expect(breaker.allowCall()).toBe(true);
    expect(breaker.state).toBe('half_open');
  });

  it('closes on success from half-open', () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    (breaker as any).openedAt = Date.now() - 31_000;
    breaker.allowCall(); // → half_open
    breaker.recordSuccess();
    expect(breaker.state).toBe('closed');
  });

  it('re-opens immediately if a probe fails in half-open', () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    (breaker as any).openedAt = Date.now() - 31_000;
    breaker.allowCall(); // → half_open
    breaker.recordFailure();
    expect(breaker.state).toBe('open');
  });
});
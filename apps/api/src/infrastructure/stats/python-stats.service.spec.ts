// apps/api/src/infrastructure/stats/python-stats.service.spec.ts
// Unit tests for the V3 normality/wilcoxon/describe-auto passthrough (task 2.6):
// success path, timeout, and circuit-breaker-open rejection. fetch is stubbed
// at the module level so no live HTTP is performed.

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CircuitBreaker } from './circuit-breaker';
import { PythonStatsService } from './python-stats.service';

const ok = (body: unknown) =>
  ({
    ok: true,
    json: async () => body,
  }) as unknown as Response;

const fail = (status = 500) =>
  ({
    ok: false,
    status,
    json: async () => ({ message: 'err' }),
  }) as unknown as Response;

describe('PythonStatsService — V3 normality/wilcoxon/describe-auto', () => {
  let breaker: CircuitBreaker;
  let originalFetch: typeof fetch;
  const fetchMock = jest.fn<typeof fetch>();

  beforeEach(() => {
    breaker = new CircuitBreaker();
    originalFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    fetchMock.mockReset();
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
  });

  it('runNormality returns the parsed envelope on success', async () => {
    fetchMock.mockResolvedValue(
      ok({ statistic: 0.97, pValue: 0.42, isNormal: true, n: 10, warnings: [] }),
    );
    const svc = new PythonStatsService(breaker);
    const res = await svc.runNormality([1, 2, 3]);
    expect(res.isNormal).toBe(true);
    expect(res.n).toBe(10);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/internal/stats/normality'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('runWilcoxon returns the parsed envelope on success', async () => {
    fetchMock.mockResolvedValue(
      ok({ statistic: 12, pValue: 0.04, z: 2.05, n: 8, warnings: [] }),
    );
    const svc = new PythonStatsService(breaker);
    const res = await svc.runWilcoxon([20, 21, 19], [15, 16, 14]);
    expect(res.pValue).toBe(0.04);
    expect(res.n).toBe(8);
  });

  it('runDescribeAuto returns representation chosen by Python', async () => {
    fetchMock.mockResolvedValue(
      ok({
        representation: 'mean_sd', mean: 2, sd: 0.1, median: null, q1: null, q3: null,
        n: 9, normality: null, warnings: [],
      }),
    );
    const svc = new PythonStatsService(breaker);
    const res = await svc.runDescribeAuto([1, 2, 3]);
    expect(res.representation).toBe('mean_sd');
    expect(res.mean).toBe(2);
  });

  it('rejects with stats_service_http_<status> on non-ok response', async () => {
    fetchMock.mockResolvedValue(fail(503));
    const svc = new PythonStatsService(breaker);
    await expect(svc.runNormality([1, 2, 3])).rejects.toThrow('stats_service_http_503');
  });

  it('rejects immediately when the circuit breaker is open', async () => {
    // force open: 3 failures
    breaker.recordFailure(); breaker.recordFailure(); breaker.recordFailure();
    expect(breaker.state).toBe('open');
    const svc = new PythonStatsService(breaker);
    await expect(svc.runNormality([1, 2, 3])).rejects.toThrow('stats_service_circuit_open');
    await expect(svc.runWilcoxon([1], [2])).rejects.toThrow('stats_service_circuit_open');
    await expect(svc.runDescribeAuto([1])).rejects.toThrow('stats_service_circuit_open');
    // fetch must not be called when breaker is open
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('records a failure on fetch rejection (timeout abort)', async () => {
    fetchMock.mockRejectedValue(new Error('The operation was aborted'));
    const svc = new PythonStatsService(breaker);
    await expect(svc.runNormality([1, 2, 3])).rejects.toThrow();
    // one failure recorded but breaker still closed (<3)
    expect(breaker.state).toBe('closed');
  });

  it('health() returns false when fetch throws (graceful)', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    const svc = new PythonStatsService(breaker);
    expect(await svc.health()).toBe(false);
  });

  it('health() returns true on 200', async () => {
    fetchMock.mockResolvedValue(ok({ status: 'ok' }));
    const svc = new PythonStatsService(breaker);
    expect(await svc.health()).toBe(true);
  });
});
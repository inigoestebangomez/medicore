// apps/api/src/infrastructure/stats/python-stats.service.ts
// Client for the Python stats microservice (spec §1, BR-RES-005, design AD-1).
// Communicates over HTTP (FastAPI) — the BullMQ queue wraps this service for
// async processing (StatsProcessor). Includes a circuit breaker (3 fails/60s)
// and a 10s timeout with graceful degradation: on Python unavailability callers
// receive a warning envelope rather than a 5xx (design).
//
// The Python service is stateless and mirrors @medicore/contracts Zod schemas
// via the codegen script (apps/stats-service/scripts/zod_to_pydantic.py) so
// no manual contract drift.

import { Injectable, Logger } from '@nestjs/common';
import type {
  InferentialTestType,
  StatisticalTestResult,
  CrossTabResult,
  SurvivalResult,
  InferentialRequest,
} from '@medicore/contracts';
import { CircuitBreaker } from './circuit-breaker';

export interface RunInferentialInput {
  queryId?: string;
  groupField?: string;
  valueField?: string;
  data?: Record<string, unknown>;
  alpha?: number;
}

const PYTHON_BASE_URL =
  process.env.STATS_SERVICE_URL ?? 'http://localhost:8100';
const TIMEOUT_MS = 10_000;

@Injectable()
export class PythonStatsService {
  private readonly logger = new Logger(PythonStatsService.name);

  constructor(private readonly breaker: CircuitBreaker) {}

  async runInferential(
    test: InferentialTestType,
    input: RunInferentialInput,
  ): Promise<StatisticalTestResult> {
    if (!this.breaker.allowCall()) {
      throw new Error('stats_service_circuit_open');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const body: InferentialRequest = {
        test,
        data: (input.data ?? {}) as any,
        alpha: input.alpha ?? 0.05,
      };
      const res = await fetch(`${PYTHON_BASE_URL}/internal/stats/inferential`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`stats_service_http_${res.status}`);
      }
      const json = (await res.json()) as StatisticalTestResult;
      this.breaker.recordSuccess();
      return json;
    } catch (err) {
      this.breaker.recordFailure();
      this.logger.warn(`Inferential test ${test} failed: ${(err as Error).message}`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async computeCrossTab(
    rowField: string,
    colField: string,
    data: Record<string, unknown>,
  ): Promise<CrossTabResult> {
    if (!this.breaker.allowCall()) throw new Error('stats_service_circuit_open');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${PYTHON_BASE_URL}/internal/cross-tab`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rowField, colField, data }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`stats_service_http_${res.status}`);
      this.breaker.recordSuccess();
      return (await res.json()) as CrossTabResult;
    } catch (err) {
      this.breaker.recordFailure();
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async computeSurvival(
    timeField: string,
    eventField: string,
    data: Record<string, unknown>,
  ): Promise<SurvivalResult> {
    if (!this.breaker.allowCall()) throw new Error('stats_service_circuit_open');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${PYTHON_BASE_URL}/internal/survival`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ timeField, eventField, data }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`stats_service_http_${res.status}`);
      this.breaker.recordSuccess();
      return (await res.json()) as SurvivalResult;
    } catch (err) {
      this.breaker.recordFailure();
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Lightweight health check used on startup / readiness probe. */
  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${PYTHON_BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}
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
  AssumptionWarning,
} from '@medicore/contracts';
import { CircuitBreaker } from './circuit-breaker';

/** Relative risk result from Python /internal/stats/relative-risk. */
export interface RelativeRiskServiceResult {
  relativeRisk: number | null;
  ci95Lower: number | null;
  ci95Upper: number | null;
  oddsRatio: number | null;
  orCi95Lower: number | null;
  orCi95Upper: number | null;
  exposedCases: number;
  exposedNonCases: number;
  unexposedCases: number;
  unexposedNonCases: number;
  suppressed: boolean;
  suppressReason: string | null;
  warnings: AssumptionWarning[];
}

/** P-value adjustment result from Python /internal/stats/p-adjust. */
export interface PAdjustServiceResult {
  method: 'holm' | 'fdr';
  originalP: number[];
  adjustedP: number[];
  n: number;
}

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

  // ─────────────────────────────────────────────
// V4 — Agreement tests: Kappa/ICC/Cronbach (REQ-FB-010)
// Same circuit-breaker + 5s timeout pattern. Endpoints are added to the
// Python service in apps/stats-service/app/routers/agreement.py.
// ─────────────────────────────────────────────

async runKappa(
  raterA: Array<string | number | boolean>,
  raterB: Array<string | number | boolean>,
  alpha = 0.05,
): Promise<AgreementResult> {
  return this.callAgreement('/internal/stats/kappa', { raterA, raterB, alpha });
}

async runIcc(valuesByRater: number[][], alpha = 0.05): Promise<AgreementResult> {
  return this.callAgreement('/internal/stats/icc', { valuesByRater, alpha });
}

async runCronbach(itemsBySubject: number[][], alpha = 0.05): Promise<AgreementResult> {
  return this.callAgreement('/internal/stats/cronbach', { itemsBySubject, alpha });
}

private async callAgreement(
  path: string,
  body: Record<string, unknown>,
): Promise<AgreementResult> {
  if (!this.breaker.allowCall()) throw new Error('stats_service_circuit_open');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(`${PYTHON_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`stats_service_http_${res.status}`);
    this.breaker.recordSuccess();
    return (await res.json()) as AgreementResult;
  } catch (err) {
    this.breaker.recordFailure();
    this.logger.warn(`Agreement test ${path} failed: ${(err as Error).message}`);
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

  // ─────────────────────────────────────────────
  // V3 — Normality + Wilcoxon (Table 1 / Pre-Post, M2/M3)
  // Same circuit-breaker + timeout + graceful degradation pattern.
  // ─────────────────────────────────────────────

  async runNormality(values: number[], alpha = 0.05): Promise<NormalityResult> {
    if (!this.breaker.allowCall()) throw new Error('stats_service_circuit_open');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      const res = await fetch(`${PYTHON_BASE_URL}/internal/stats/normality`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ values, alpha }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`stats_service_http_${res.status}`);
      this.breaker.recordSuccess();
      return (await res.json()) as NormalityResult;
    } catch (err) {
      this.breaker.recordFailure();
      this.logger.warn(`Normality test failed: ${(err as Error).message}`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async runWilcoxon(pre: number[], post: number[], alpha = 0.05): Promise<WilcoxonResult> {
    if (!this.breaker.allowCall()) throw new Error('stats_service_circuit_open');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      const res = await fetch(`${PYTHON_BASE_URL}/internal/stats/wilcoxon`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pre, post, alpha }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`stats_service_http_${res.status}`);
      this.breaker.recordSuccess();
      return (await res.json()) as WilcoxonResult;
    } catch (err) {
      this.breaker.recordFailure();
      this.logger.warn(`Wilcoxon test failed: ${(err as Error).message}`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async runDescribeAuto(values: number[], alpha = 0.05): Promise<DescribeAutoResult> {
    if (!this.breaker.allowCall()) throw new Error('stats_service_circuit_open');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      const res = await fetch(`${PYTHON_BASE_URL}/internal/stats/describe-auto`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ values, alpha }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`stats_service_http_${res.status}`);
      this.breaker.recordSuccess();
      return (await res.json()) as DescribeAutoResult;
    } catch (err) {
      this.breaker.recordFailure();
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // ─────────────────────────────────────────────
  // V5 — Guided analysis: RR/OR + p-value adjustment
  // Same circuit-breaker + timeout pattern.
  // ─────────────────────────────────────────────

  async computeRelativeRisk(input: {
    exposedCases: number;
    exposedNonCases: number;
    unexposedCases: number;
    unexposedNonCases: number;
    alpha?: number;
  }): Promise<RelativeRiskServiceResult> {
    if (!this.breaker.allowCall()) throw new Error('stats_service_circuit_open');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      const res = await fetch(`${PYTHON_BASE_URL}/internal/stats/relative-risk`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`stats_service_http_${res.status}`);
      this.breaker.recordSuccess();
      return (await res.json()) as RelativeRiskServiceResult;
    } catch (err) {
      this.breaker.recordFailure();
      this.logger.warn(`Relative risk computation failed: ${(err as Error).message}`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async adjustPValues(input: {
    method: 'holm' | 'fdr';
    pValues: number[];
  }): Promise<PAdjustServiceResult> {
    if (!this.breaker.allowCall()) throw new Error('stats_service_circuit_open');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      const res = await fetch(`${PYTHON_BASE_URL}/internal/stats/p-adjust`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`stats_service_http_${res.status}`);
      this.breaker.recordSuccess();
      return (await res.json()) as PAdjustServiceResult;
    } catch (err) {
      this.breaker.recordFailure();
      this.logger.warn(`P-value adjustment failed: ${(err as Error).message}`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

// ─────────────────────────────────────────────
// V3 result shapes (mirror Pydantic schemas.py normality section)
// ─────────────────────────────────────────────

export interface NormalityResult {
  statistic: number | null;
  pValue: number | null;
  isNormal: boolean;
  n: number;
  warnings: string[];
}

export interface WilcoxonResult {
  statistic: number | null;
  pValue: number | null;
  z: number | null;
  n: number;
  warnings: string[];
}

export interface DescribeAutoResult {
  representation: 'mean_sd' | 'median_iqr';
  mean: number | null;
  sd: number | null;
  median: number | null;
  q1: number | null;
  q3: number | null;
  n: number;
  normality: NormalityResult | null;
  warnings: string[];
}

// V4 — agreement test result (Kappa/ICC/Cronbach), mirror of Pydantic.
export interface AgreementResult {
  statistic: number | null;
  pValue: number | null;
  n: number;
  warnings: string[];
}
// apps/api/src/application/research/services/time-series.service.ts
// Temporal trends (spec §3, time-series-analysis). Groups events by period
// (month/quarter/year) and renders point series with an empty-period strategy:
// periods with zero events are emitted as count=0 so the chart axis never breaks.
// Trend slope via simple linear regression on the period counts.

import { Injectable } from '@nestjs/common';
import type { TimeSeriesPeriod, TimeSeriesResult, TimeSeriesPoint } from '@medicore/contracts';

export interface TimeSeriesEvent {
  /** ISO date string or Date for the event occurrence */
  date: string | Date;
}

const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

@Injectable()
export class TimeSeriesService {
  compute(
    events: TimeSeriesEvent[],
    metric: string,
    period: TimeSeriesPeriod,
  ): TimeSeriesResult {
    if (events.length === 0) {
      return { metric, period, points: [], trendSlope: null };
    }

    const counts = new Map<string, number>();
    for (const ev of events) {
      const d = ev.date instanceof Date ? ev.date : new Date(ev.date);
      if (Number.isNaN(d.getTime())) continue;
      const key = this.periodKey(d, period);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    // Fill empty periods between min and max so the axis doesn't break (spec §3).
    const keys = Array.from(counts.keys()).sort();
    const filled = this.fillEmptyPeriods(keys, period);

    const points: TimeSeriesPoint[] = filled.map((key) => ({
      period: key,
      count: counts.get(key) ?? 0,
    }));

    const trendSlope = this.linearRegressionSlope(points.map((p) => p.count));

    return { metric, period, points, trendSlope };
  }

  // ─────────────────────────────────────────────
  // Period bucketing
  // ─────────────────────────────────────────────

  private periodKey(d: Date, period: TimeSeriesPeriod): string {
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    switch (period) {
      case 'month':
        return `${year}-${MONTHS[month]}`;
      case 'quarter': {
        const q = Math.floor(month / 3);
        return `${year}-${QUARTERS[q]}`;
      }
      case 'year':
        return String(year);
      default:
        return `${year}-${MONTHS[month]}`;
    }
  }

  /** Enumerate every period key between the min and max keys (inclusive). */
  private fillEmptyPeriods(existing: string[], period: TimeSeriesPeriod): string[] {
    if (existing.length === 0) return [];
    const sorted = [...existing].sort();
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const result: string[] = [];
    if (period === 'year') {
      for (let y = Number(min); y <= Number(max); y++) result.push(String(y));
      return result;
    }
    if (period === 'month') {
      let [y, m] = min.split('-').map(Number);
      let [ey, em] = max.split('-').map(Number);
      while (y < ey || (y === ey && m <= em)) {
        result.push(`${y}-${MONTHS[m - 1]}`);
        m++;
        if (m > 12) { m = 1; y++; }
      }
      return result;
    }
    // quarter
    const allQuarters: string[] = [];
    for (let year = 1900; year <= 9999; year++) {
      for (const q of QUARTERS) allQuarters.push(`${year}-${q}`);
    }
    const startIdx = allQuarters.indexOf(min);
    const endIdx = allQuarters.indexOf(max);
    if (startIdx === -1 || endIdx === -1) return existing;
    return allQuarters.slice(startIdx, endIdx + 1);
  }

  // ─────────────────────────────────────────────
  // Trend (simple least-squares slope)
  // ─────────────────────────────────────────────

  private linearRegressionSlope(counts: number[]): number | null {
    const n = counts.length;
    if (n < 2) return null;
    const xs = counts.map((_, i) => i);
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = counts.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - meanX) * (counts[i] - meanY);
      den += Math.pow(xs[i] - meanX, 2);
    }
    if (den === 0) return 0;
    return Math.round((num / den) * 1000) / 1000;
  }
}
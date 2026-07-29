// apps/api/src/application/research/services/time-series.service.spec.ts
import { describe, it, expect } from '@jest/globals';
import { TimeSeriesService } from './time-series.service';

const svc = new TimeSeriesService();

describe('TimeSeriesService', () => {
  it('groups events by month', () => {
    const events = [
      { date: '2024-01-05' },
      { date: '2024-01-20' },
      { date: '2024-02-14' },
      { date: '2024-02-14' },
      { date: '2024-02-28' },
    ];
    const r = svc.compute(events, 'surgeries', 'month');
    const jan = r.points.find((p) => p.period === '2024-01');
    const feb = r.points.find((p) => p.period === '2024-02');
    expect(jan?.count).toBe(2);
    expect(feb?.count).toBe(3);
  });

  it('fills empty periods as zero (spec §3)', () => {
    const events = [
      { date: '2024-01-05' },
      { date: '2024-03-05' }, // February empty in between
    ];
    const r = svc.compute(events, 'consultations', 'month');
    expect(r.points.map((p) => p.period)).toEqual(['2024-01', '2024-02', '2024-03']);
    expect(r.points.find((p) => p.period === '2024-02')?.count).toBe(0);
  });

  it('groups by year and folds empty years', () => {
    const events = [{ date: '2023-06-01' }, { date: '2025-01-01' }];
    const r = svc.compute(events, 'm', 'year');
    expect(r.points.map((p) => p.period)).toEqual(['2023', '2024', '2025']);
  });

  it('computes a positive trend slope for increasing series', () => {
    const events: Array<{ date: string }> = [];
    for (let m = 0; m < 6; m++) {
      for (let i = 0; i < (m + 1) * 2; i++) events.push({ date: `2024-${String(m + 1).padStart(2, '0')}-01` });
    }
    const r = svc.compute(events, 'm', 'month');
    expect(r.trendSlope).not.toBeNull();
    expect(r.trendSlope).toBeGreaterThan(0);
  });

  it('returns empty points + null slope for no events', () => {
    const r = svc.compute([], 'm', 'month');
    expect(r.points).toEqual([]);
    expect(r.trendSlope).toBeNull();
  });
});
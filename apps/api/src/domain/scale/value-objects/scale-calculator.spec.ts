// apps/api/src/domain/scale/value-objects/scale-calculator.spec.ts
import { describe, it, expect } from '@jest/globals';
import { calculateTotal } from './scale-calculator';

describe('Scale Calculator (BR-SCA-002: Server-side total recalculation)', () => {
  // SCA-002: SNOT-22 total
  it('should sum all SNOT-22 scores correctly', () => {
    const scores: Record<string, number> = {};
    for (let i = 1; i <= 22; i++) {
      scores[`item_${i}`] = 2;
    }
    const total = calculateTotal('SNOT_22', scores);
    expect(total).toBe(44);
  });

  // SCA-002: DHI total
  it('should sum all DHI scores correctly', () => {
    const scores: Record<string, number> = {};
    for (let i = 1; i <= 25; i++) {
      scores[`item_${i}`] = 1;
    }
    const total = calculateTotal('DHI', scores);
    expect(total).toBe(25);
  });

  // SCA-002: VHI total
  it('should sum VHI scores correctly', () => {
    const scores = { v1: 3, v2: 2, v3: 1 };
    expect(calculateTotal('VHI', scores)).toBe(6);
  });

  // SCA-002: CUSTOM total
  it('should sum CUSTOM scale scores correctly', () => {
    const scores = { pain: 7, sleep: 3 };
    expect(calculateTotal('CUSTOM', scores)).toBe(10);
  });

  // BR-SCA-002: Client-sent total is ignored (verified by use case, not calculator)
  it('should calculate total solely from scores, ignoring any external total', () => {
    const scores = { a: 5, b: 5 };
    const total = calculateTotal('CUSTOM', scores);
    expect(total).toBe(10); // Not 99 or any other client-sent value
  });

  it('should return 0 for empty scores', () => {
    expect(calculateTotal('CUSTOM', {})).toBe(0);
  });

  it('should handle mixed positive and zero values', () => {
    const scores = { a: 0, b: 3, c: 0, d: 5 };
    expect(calculateTotal('CUSTOM', scores)).toBe(8);
  });
});
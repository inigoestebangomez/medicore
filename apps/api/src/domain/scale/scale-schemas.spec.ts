// apps/api/src/domain/scale/scale-schemas.spec.ts
// SCA-001: Per-scale Zod schema validation (BR-SCA-001)

import { describe, it, expect } from '@jest/globals';
import {
  ScaleTypeValidationMap,
  Snot22ScoresSchema,
  DhiScoresSchema,
  VhiScoresSchema,
  OsaEpworthScoresSchema,
  StopbangScoresSchema,
  CustomScoresSchema,
  ClinicalScaleTypeSchema,
} from '@medicore/contracts';

function buildScores(count: number, value: number): Record<string, number> {
  const scores: Record<string, number> = {};
  for (let i = 1; i <= count; i++) scores[`item_${i}`] = value;
  return scores;
}

describe('SCA-001 — Per-scale Zod schema validation', () => {
  // SNOT-22
  describe('SNOT_22', () => {
    it('accepts 22 items with values 0–5', () => {
      const scores = buildScores(22, 3);
      expect(Snot22ScoresSchema.safeParse(scores).success).toBe(true);
    });

    it('rejects fewer than 22 items', () => {
      expect(Snot22ScoresSchema.safeParse(buildScores(10, 2)).success).toBe(false);
    });

    it('rejects more than 22 items', () => {
      expect(Snot22ScoresSchema.safeParse(buildScores(25, 1)).success).toBe(false);
    });

    it('rejects values out of range (max 5)', () => {
      const scores = buildScores(22, 6);
      expect(Snot22ScoresSchema.safeParse(scores).success).toBe(false);
    });
  });

  // DHI
  describe('DHI', () => {
    it('accepts 25 items 0–4', () => {
      expect(DhiScoresSchema.safeParse(buildScores(25, 2)).success).toBe(true);
    });

    it('rejects wrong item count', () => {
      expect(DhiScoresSchema.safeParse(buildScores(10, 1)).success).toBe(false);
    });

    it('rejects value 5 (max 4)', () => {
      expect(DhiScoresSchema.safeParse(buildScores(25, 5)).success).toBe(false);
    });
  });

  // VHI
  describe('VHI', () => {
    it('accepts at least 1 item 0–4', () => {
      expect(VhiScoresSchema.safeParse({ v1: 3, v2: 1 }).success).toBe(true);
    });

    it('rejects empty scores', () => {
      expect(VhiScoresSchema.safeParse({}).success).toBe(false);
    });
  });

  // OSA EPWORTH
  describe('OSA_EPWORTH', () => {
    it('accepts exactly 8 items 0–3', () => {
      expect(OsaEpworthScoresSchema.safeParse(buildScores(8, 2)).success).toBe(true);
    });
    it('rejects not-8 items', () => {
      expect(OsaEpworthScoresSchema.safeParse(buildScores(7, 1)).success).toBe(false);
    });
  });

  // STOP-BANG
  describe('STOPBANG', () => {
    it('accepts 8 binary items (0/1)', () => {
      expect(StopbangScoresSchema.safeParse(buildScores(8, 1)).success).toBe(true);
    });
    it('rejects value 2 (binary only)', () => {
      expect(StopbangScoresSchema.safeParse(buildScores(8, 2)).success).toBe(false);
    });
  });

  // CUSTOM
  describe('CUSTOM', () => {
    it('accepts at least one key-value pair', () => {
      expect(CustomScoresSchema.safeParse({ custom_metric: 42 }).success).toBe(true);
    });

    it('rejects empty scores {} (422 INVALID_SCALE_SCORES scenario)', () => {
      expect(CustomScoresSchema.safeParse({}).success).toBe(false);
    });

    it('accepts multiple numeric values', () => {
      expect(CustomScoresSchema.safeParse({ pain: 7, sleep: 3 }).success).toBe(true);
    });
  });

  // ScaleTypeValidationMap wiring (used by CreateClinicalScaleUseCase)
  describe('ScaleTypeValidationMap', () => {
    it('has a schema for every ClinicalScaleType', () => {
      const types = ClinicalScaleTypeSchema.options;
      for (const t of types) {
        expect(ScaleTypeValidationMap[t as keyof typeof ScaleTypeValidationMap]).toBeDefined();
      }
    });

    it('routes SNOT_22 to the SNOT-22 schema', () => {
      expect(ScaleTypeValidationMap['SNOT_22']).toBe(Snot22ScoresSchema);
    });

    it('routes CUSTOM to the custom schema (min 1 key)', () => {
      expect(CustomScoresSchema.safeParse({}).success).toBe(false);
      expect(ScaleTypeValidationMap['CUSTOM'].safeParse({ x: 1 }).success).toBe(true);
    });
  });
});
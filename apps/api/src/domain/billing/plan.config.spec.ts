// apps/api/src/domain/billing/plan.config.spec.ts
import { PLAN_CONFIG, getLimit } from './plan.config';
import { PlanType } from '../organization/organization.types';

describe('PlanConfig', () => {
  describe('PLAN_CONFIG', () => {
    it('FREE plan has 20 AI reports/month and no Stripe price ids', () => {
      expect(PLAN_CONFIG.FREE.aiReportsPerMonth).toBe(20);
      expect(PLAN_CONFIG.FREE.stripePriceIds).toEqual({});
      expect(PLAN_CONFIG.FREE.plan).toBe(PlanType.FREE);
    });

    it('PRO plan has 200 AI reports/month', () => {
      expect(PLAN_CONFIG.PRO.aiReportsPerMonth).toBe(200);
      expect(PLAN_CONFIG.PRO.plan).toBe(PlanType.PRO);
    });

    it('ENTERPRISE has unlimited (null) AI reports', () => {
      expect(PLAN_CONFIG.ENTERPRISE.aiReportsPerMonth).toBeNull();
      expect(PLAN_CONFIG.ENTERPRISE.plan).toBe(PlanType.ENTERPRISE);
    });
  });

  describe('getLimit', () => {
    it('returns 20 for FREE', () => {
      expect(getLimit(PlanType.FREE)).toBe(20);
    });

    it('returns 200 for PRO', () => {
      expect(getLimit(PlanType.PRO)).toBe(200);
    });

    it('returns null for ENTERPRISE (unlimited)', () => {
      expect(getLimit(PlanType.ENTERPRISE)).toBeNull();
    });

    it('returns null for unknown plan (defensive: unlimited over block)', () => {
      expect(getLimit('UNKNOWN' as PlanType)).toBeNull();
    });
  });
});
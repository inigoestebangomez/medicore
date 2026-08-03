// apps/api/src/api/research/research-form.feature-flag.spec.ts
// Feature-flag gating tests (6.4): every V4 controller declares a
// @RequireFeature flag, and the FeatureFlagGuard rejects requests with a
// FeatureDisabledError (mapped to 403) when that flag is disabled
// (REQ-FB-013 scenario "flag desactivado").

import { describe, it, expect, afterEach, beforeEach } from '@jest/globals';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { FeatureFlagGuard, FEATURE_FLAG_KEY } from '@/infrastructure/config/feature-flag.guard';
import { FeatureFlagsService } from '@/infrastructure/config/feature-flags.service';
import { VariableBuilderController } from './variable-builder.controller';
import { SubjectController } from './subject.controller';
import { AnalysisController } from './analysis.controller';
import { TemplateController } from './template.controller';

const V4_CONTROLLERS = [
  [VariableBuilderController, 'RESEARCH_FORM_BUILDER'],
  [SubjectController, 'RESEARCH_FORM_BUILDER'],
  [AnalysisController, 'RESEARCH_FORM_BUILDER'],
  [TemplateController, 'RESEARCH_VARIABLE_LIBRARY'],
] as const;

function ctxFor(target: { new (...a: any[]): any }): ExecutionContext {
  return {
    getClass: () => target,
    getHandler: () => (target.prototype.list ?? target.prototype.create),
    getArgs: () => [],
    getArgAt: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }) as any,
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

describe('V4 controllers declare the correct feature flag (REQ-FB-013)', () => {
  for (const [ctrl, flag] of V4_CONTROLLERS) {
    it(`${ctrl.name} requires ${flag}`, () => {
      const meta = Reflect.getMetadata(FEATURE_FLAG_KEY, ctrl);
      expect(meta).toBe(flag);
    });
  }
});

describe('FeatureFlagGuard rejects V4 routes when the flag is OFF (REQ-FB-013)', () => {
  const stubFlags = new FeatureFlagsService();
  const guard = new FeatureFlagGuard(new Reflector(), stubFlags);

  beforeEach(() => {
    // Force both V4 flags OFF, save originals to restore.
    (process.env as any).RESEARCH_FORM_BUILDER = 'false';
    (process.env as any).RESEARCH_VARIABLE_LIBRARY = 'false';
  });
  afterEach(() => {
    delete process.env.RESEARCH_FORM_BUILDER;
    delete process.env.RESEARCH_VARIABLE_LIBRARY;
  });

  it('blocks VariableBuilderController (RESEARCH_FORM_BUILDER)', () => {
    const ctx = ctxFor(VariableBuilderController);
    expect(() => guard.canActivate(ctx)).toThrow();
  });

  it('blocks TemplateController (RESEARCH_VARIABLE_LIBRARY)', () => {
    const ctx = ctxFor(TemplateController);
    expect(() => guard.canActivate(ctx)).toThrow();
  });

  it('allows when the flag is ON', () => {
    (process.env as any).RESEARCH_FORM_BUILDER = 'true';
    const ctx = ctxFor(VariableBuilderController);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('absent env → enabled (opt-out default ON)', () => {
    delete process.env.RESEARCH_FORM_BUILDER;
    const ctx = ctxFor(VariableBuilderController);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
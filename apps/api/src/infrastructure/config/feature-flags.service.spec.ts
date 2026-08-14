import { afterEach, describe, expect, it } from '@jest/globals';
import { FeatureFlagsService } from './feature-flags.service';

describe('FeatureFlagsService import rollout', () => {
  afterEach(() => {
    delete process.env.IMPORT_IDENTITY_LIGHT;
  });

  it('keeps identity-light disabled by default', () => {
    delete process.env.IMPORT_IDENTITY_LIGHT;
    expect(new FeatureFlagsService().isEnabled('IMPORT_IDENTITY_LIGHT')).toBe(false);
  });

  it('enables identity-light only when explicitly opted in', () => {
    process.env.IMPORT_IDENTITY_LIGHT = 'true';
    expect(new FeatureFlagsService().isEnabled('IMPORT_IDENTITY_LIGHT')).toBe(true);
  });
});

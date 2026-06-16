import { describe, it, expect } from 'vitest';
import * as contracts from './index';

describe('@medicore/contracts', () => {
  it('should export barrel module', () => {
    expect(contracts).toBeDefined();
  });
});
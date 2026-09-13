import { describe, expect, it } from 'vitest';

import { EXTRACTOR_VERSION, FEATURE_COUNT, FEATURE_INDEX, FEATURE_NAMES } from './version';

describe('feature specification', () => {
  it('has exactly FEATURE_COUNT names', () => {
    expect(FEATURE_NAMES.length).toBe(FEATURE_COUNT);
    expect(FEATURE_COUNT).toBe(53);
  });

  it('has no duplicate feature names', () => {
    const unique = new Set(FEATURE_NAMES);
    expect(unique.size).toBe(FEATURE_NAMES.length);
  });

  it('uses non-empty snake_case names', () => {
    for (const name of FEATURE_NAMES) {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('builds an index map that agrees with the array order', () => {
    FEATURE_NAMES.forEach((name, index) => {
      expect(FEATURE_INDEX[name]).toBe(index);
    });
  });

  it('pins the extractor version', () => {
    expect(EXTRACTOR_VERSION).toBe(1);
  });
});

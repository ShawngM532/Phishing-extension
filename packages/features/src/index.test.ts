import { describe, expect, it } from 'vitest';

import { EXTRACTOR_VERSION, extractStage1, FEATURE_COUNT, parseUrl } from './index';

describe('@sentinel/features public API', () => {
  it('exposes the extractor version and feature count', () => {
    expect(EXTRACTOR_VERSION).toBe(1);
    expect(FEATURE_COUNT).toBe(53);
  });

  it('extracts a stage 1 vector', () => {
    const vector = extractStage1('https://example.com/login');
    expect(vector).not.toBeNull();
    expect(vector?.length).toBe(FEATURE_COUNT);
  });

  it('exposes URL parsing', () => {
    expect(parseUrl('https://example.com')?.etld1).toBe('example.com');
  });
});

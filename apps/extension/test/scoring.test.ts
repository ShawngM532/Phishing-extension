import type { Verdict } from '@sentinel/heuristics';
import { describe, expect, it } from 'vitest';

import { heuristicEngine } from '../src/background/engine';
import { isAllowlisted, mergeVerdicts, scoreFeatures } from '../src/background/scoring';
import type { Settings } from '../src/background/settings';

function verdict(level: Verdict['level'], score: number): Verdict {
  return { level, score, reasons: [], engine: 'heuristic', extractorVersion: 1 };
}

const SETTINGS: Settings = {
  enabled: true,
  allowlist: ['xero.com'],
  thresholds: { medium: 0.35, high: 0.75 },
};

describe('mergeVerdicts', () => {
  it('returns the only stage available', () => {
    const stage1 = verdict('MEDIUM', 0.5);
    expect(mergeVerdicts(stage1, null)).toBe(stage1);
    expect(mergeVerdicts(null, stage1)).toBe(stage1);
    expect(mergeVerdicts(null, null)).toBeNull();
  });

  it('never downgrades a HIGH from stage 1', () => {
    expect(mergeVerdicts(verdict('HIGH', 0.9), verdict('LOW', 0.05))?.level).toBe('HIGH');
  });

  it('lets a clean DOM rescue a MEDIUM stage 1', () => {
    expect(mergeVerdicts(verdict('MEDIUM', 0.4), verdict('LOW', 0.1))?.level).toBe('LOW');
  });

  it('takes the stronger stage otherwise', () => {
    expect(mergeVerdicts(verdict('LOW', 0.1), verdict('HIGH', 0.8))?.level).toBe('HIGH');
    expect(mergeVerdicts(verdict('MEDIUM', 0.5), verdict('MEDIUM', 0.6))?.score).toBe(0.6);
  });
});

describe('isAllowlisted', () => {
  it('matches the eTLD+1 against the allowlist', () => {
    expect(isAllowlisted('https://login.xero.com/', SETTINGS)).toBe(true);
    expect(isAllowlisted('https://example.com/', SETTINGS)).toBe(false);
    expect(isAllowlisted('about:blank', SETTINGS)).toBe(false);
  });
});

describe('scoreFeatures', () => {
  it('produces a verdict through the engine', () => {
    const features = new Float32Array(53);
    const result = scoreFeatures(heuristicEngine, 'https://example.com/', features, SETTINGS);
    expect(result.engine).toBe('heuristic');
    expect(result.level).toBe('LOW');
  });
});

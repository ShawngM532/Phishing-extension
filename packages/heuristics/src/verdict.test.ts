import { describe, expect, it } from 'vitest';

import { levelForScore, maxLevel, toVerdict } from './verdict';

const THRESHOLDS = { medium: 0.35, high: 0.75 };

describe('levelForScore', () => {
  it.each([
    [0, 'LOW'],
    [0.34, 'LOW'],
    [0.35, 'MEDIUM'],
    [0.74, 'MEDIUM'],
    [0.75, 'HIGH'],
    [1, 'HIGH'],
  ] as const)('score %s -> %s', (score, level) => {
    expect(levelForScore(score, THRESHOLDS)).toBe(level);
  });
});

describe('maxLevel', () => {
  it('orders UNKNOWN < LOW < MEDIUM < HIGH', () => {
    expect(maxLevel('LOW', 'HIGH')).toBe('HIGH');
    expect(maxLevel('MEDIUM', 'LOW')).toBe('MEDIUM');
    expect(maxLevel('UNKNOWN', 'LOW')).toBe('LOW');
    expect(maxLevel('HIGH', 'HIGH')).toBe('HIGH');
  });
});

describe('toVerdict', () => {
  it('maps a score to a level', () => {
    const verdict = toVerdict({
      score: 0.8,
      reasons: [],
      engine: 'heuristic',
      extractorVersion: 1,
      thresholds: THRESHOLDS,
    });
    expect(verdict.level).toBe('HIGH');
    expect(verdict.score).toBe(0.8);
  });

  it('short-circuits an allowlisted page to LOW', () => {
    const verdict = toVerdict({
      score: 0.9,
      reasons: [],
      engine: 'model',
      extractorVersion: 1,
      allowlisted: true,
    });
    expect(verdict.level).toBe('LOW');
    expect(verdict.score).toBe(0);
    expect(verdict.reasons[0]?.code).toBe('ALLOWLISTED');
  });

  it('raises but never lowers the level for an override', () => {
    const raised = toVerdict({
      score: 0.1,
      reasons: [],
      engine: 'heuristic',
      extractorVersion: 1,
      thresholds: THRESHOLDS,
      override: 'HIGH',
    });
    expect(raised.level).toBe('HIGH');

    const notLowered = toVerdict({
      score: 0.9,
      reasons: [],
      engine: 'heuristic',
      extractorVersion: 1,
      thresholds: THRESHOLDS,
      override: 'MEDIUM',
    });
    expect(notLowered.level).toBe('HIGH');
  });

  it('includes the model version when provided', () => {
    const verdict = toVerdict({
      score: 0.5,
      reasons: [],
      engine: 'model',
      extractorVersion: 1,
      modelVersion: 7,
    });
    expect(verdict.modelVersion).toBe(7);
  });

  it('omits the model version for the heuristic engine', () => {
    const verdict = toVerdict({
      score: 0.5,
      reasons: [],
      engine: 'heuristic',
      extractorVersion: 1,
    });
    expect('modelVersion' in verdict).toBe(false);
  });
});

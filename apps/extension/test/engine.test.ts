import { FEATURE_INDEX } from '@sentinel/features';
import { describe, expect, it } from 'vitest';

import { heuristicEngine } from '../src/background/engine';

function phishingVector(): Float32Array {
  const vector = new Float32Array(53);
  vector[FEATURE_INDEX.is_https] = 1;
  vector[FEATURE_INDEX.host_is_ip] = 1;
  vector[FEATURE_INDEX.has_password_input] = 1;
  return vector;
}

describe('heuristicEngine', () => {
  it('is named heuristic', () => {
    expect(heuristicEngine.name).toBe('heuristic');
  });

  it('flags an ip-host password page as HIGH via hard override', () => {
    const verdict = heuristicEngine.score({
      url: 'http://127.0.0.1/login',
      features: phishingVector(),
      extractorVersion: 1,
    });
    expect(verdict.level).toBe('HIGH');
    expect(verdict.engine).toBe('heuristic');
    expect(verdict.extractorVersion).toBe(1);
  });

  it('accepts a plain number array', () => {
    const verdict = heuristicEngine.score({
      url: 'http://127.0.0.1/login',
      features: Array.from(phishingVector()),
      extractorVersion: 1,
    });
    expect(verdict.level).toBe('HIGH');
  });

  it('honours custom thresholds', () => {
    const vector = new Float32Array(53);
    vector[FEATURE_INDEX.is_https] = 1;
    vector[FEATURE_INDEX.url_len] = 500;
    const verdict = heuristicEngine.score({
      url: 'https://example.com/',
      features: vector,
      extractorVersion: 1,
      thresholds: { medium: 0.9, high: 0.95 },
    });
    expect(verdict.level).toBe('LOW');
  });

  it('short-circuits an allowlisted page to LOW', () => {
    const verdict = heuristicEngine.score({
      url: 'http://127.0.0.1/login',
      features: phishingVector(),
      extractorVersion: 1,
      allowlisted: true,
    });
    expect(verdict.level).toBe('LOW');
    expect(verdict.reasons[0]?.code).toBe('ALLOWLISTED');
  });
});

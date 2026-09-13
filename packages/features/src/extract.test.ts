import { describe, expect, it } from 'vitest';

import { extractStage1, extractStage2 } from './extract';
import { FEATURE_COUNT, FEATURE_INDEX } from './version';

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789:/?&=#%@.-_~[]()<>\u00e9\u4e2d';

function randomString(random: () => number, maxLength: number): string {
  const length = Math.floor(random() * maxLength);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[Math.floor(random() * ALPHABET.length)] ?? 'a';
  }
  return out;
}

describe('extractStage1', () => {
  it('returns null for unscorable urls', () => {
    expect(extractStage1('about:blank')).toBeNull();
    expect(extractStage1('not a url')).toBeNull();
  });

  it('returns a full-length vector for http(s) urls', () => {
    const vector = extractStage1('https://example.com/login');
    expect(vector?.length).toBe(FEATURE_COUNT);
  });

  it('sets in_tranco_50k when a bloom filter matches', () => {
    const bloom = { m: 8, k: 1, hashSeed: 1, has: () => true };
    const vector = extractStage1('https://example.com/', { bloom });
    expect(vector?.[FEATURE_INDEX.in_tranco_50k]).toBe(1);
  });

  it('defaults in_tranco_50k to 0 without a bloom filter', () => {
    const vector = extractStage1('https://example.com/');
    expect(vector?.[FEATURE_INDEX.in_tranco_50k]).toBe(0);
  });

  it('never throws on 1000 random malformed urls', () => {
    const random = mulberry32(42);
    for (let i = 0; i < 1000; i += 1) {
      const url = randomString(random, 120);
      expect(() => extractStage1(url)).not.toThrow();
      const vector = extractStage1(url);
      if (vector !== null) expect(vector.length).toBe(FEATURE_COUNT);
    }
  });
});

describe('extractStage2', () => {
  it('records warnings and still returns a vector for a broken DOM', () => {
    const brokenDoc = {
      baseURI: 'https://example.com/',
      body: null,
      title: '',
      get documentElement(): never {
        throw new Error('boom');
      },
      querySelectorAll(): never {
        throw new Error('boom');
      },
      createTreeWalker(): never {
        throw new Error('boom');
      },
    } as unknown as Document;

    const warnings: string[] = [];
    const vector = extractStage2('https://example.com/', brokenDoc, { warnings });

    expect(vector).not.toBeNull();
    expect(vector?.length).toBe(FEATURE_COUNT);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((warning) => warning.startsWith('dom:'))).toBe(true);
  });

  it('returns null for an unscorable url', () => {
    const doc = { baseURI: 'about:blank' } as unknown as Document;
    expect(extractStage2('about:blank', doc)).toBeNull();
  });
});

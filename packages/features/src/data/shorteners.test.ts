import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { isUrlShortener, SHORTENERS } from '../data/shorteners';
import { parseUrl } from '../url/parse';

describe('shorteners', () => {
  it('has at least 30 entries', () => {
    expect(SHORTENERS.length).toBeGreaterThanOrEqual(30);
  });

  it('matches the canonical shorteners.txt', () => {
    const path = fileURLToPath(new URL('../data/shorteners.txt', import.meta.url));
    const fromFile = readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    expect([...SHORTENERS].sort()).toEqual([...fromFile].sort());
  });

  it('detects shortener hosts', () => {
    const parts = parseUrl('https://bit.ly/abc');
    expect(parts).not.toBeNull();
    expect(isUrlShortener(parts?.etld1 ?? null, parts?.hostname ?? '')).toBe(true);
  });

  it('does not flag normal hosts', () => {
    const parts = parseUrl('https://example.com/');
    expect(isUrlShortener(parts?.etld1 ?? null, parts?.hostname ?? '')).toBe(false);
  });
});

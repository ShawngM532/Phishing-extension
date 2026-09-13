import { describe, expect, it } from 'vitest';

import brands from './brands.json';

describe('brands.json', () => {
  it('has a plausible number of entries', () => {
    expect(brands.length).toBeGreaterThanOrEqual(200);
  });

  it('has no duplicate tokens', () => {
    const tokens = brands.map((brand) => brand.token);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it('matches the entry schema', () => {
    for (const brand of brands) {
      expect(typeof brand.token).toBe('string');
      expect(brand.token.length).toBeGreaterThan(1);
      expect(Array.isArray(brand.etld1s)).toBe(true);
      expect(brand.etld1s.length).toBeGreaterThan(0);
      for (const etld1 of brand.etld1s) {
        expect(etld1).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
      }
    }
  });

  it('covers the brands required by the spec', () => {
    const tokens = new Set(brands.map((brand) => brand.token));
    for (const required of [
      'xero',
      'myob',
      'realme',
      'ird',
      'nzpost',
      'trademe',
      'spark',
      'one',
      'paypal',
      'microsoft',
      'google',
      'apple',
      'amazon',
      'dhl',
      'fedex',
      'netflix',
      'facebook',
      'instagram',
      'linkedin',
      'dropbox',
      'docusign',
      'adobe',
    ]) {
      expect(tokens.has(required)).toBe(true);
    }
  });
});

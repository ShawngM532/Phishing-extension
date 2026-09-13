import { describe, expect, it } from 'vitest';

import { brandLookalikeHost, hasBrandInPath, hasBrandInSubdomain, isLegitBrandHost } from './brand';
import { parseUrl } from './parse';

function parts(url: string) {
  const parsed = parseUrl(url);
  if (parsed === null) throw new Error(`unparsable: ${url}`);
  return parsed;
}

describe('brandLookalikeHost', () => {
  it('scores a digit-substitution lookalike', () => {
    expect(brandLookalikeHost(parts('https://paypa1.com/'))).toBeCloseTo(0.1667, 2);
  });

  it('scores a legitimate brand domain as 0', () => {
    expect(brandLookalikeHost(parts('https://paypal.com/'))).toBe(0);
    expect(brandLookalikeHost(parts('https://www.xero.com/'))).toBe(0);
  });

  it('scores an unrelated domain as 1', () => {
    expect(brandLookalikeHost(parts('https://example.com/'))).toBe(1);
  });

  it('scores a hyphenated lookalike below 0.2', () => {
    expect(brandLookalikeHost(parts('https://micros0ft-login.net/'))).toBeLessThan(0.2);
  });

  it('returns 1 for an ip host', () => {
    expect(brandLookalikeHost(parts('http://192.168.0.1/'))).toBe(1);
  });

  it('returns 1 when no brand shares the first folded character', () => {
    expect(brandLookalikeHost(parts('https://zzzzzz.com/'))).toBe(1);
  });

  it('skips pure-numeric segments', () => {
    expect(brandLookalikeHost(parts('https://123456.com/'))).toBe(1);
  });

  it('short-circuits when the folded segment exactly matches a brand off its domain', () => {
    expect(brandLookalikeHost(parts('https://paypal.co/'))).toBe(0);
  });

  it('evicts the lookalike cache without losing correctness', () => {
    for (let i = 0; i < 4200; i += 1) {
      brandLookalikeHost(parts(`https://site-${String(i)}.com/`));
    }
    expect(brandLookalikeHost(parts('https://paypa1.com/'))).toBeCloseTo(0.1667, 2);
  });
});

describe('brand presence', () => {
  it('detects a brand in a subdomain', () => {
    expect(hasBrandInSubdomain(parts('https://paypal.secure-login.com/'))).toBe(true);
    expect(hasBrandInSubdomain(parts('https://secure-login.com/'))).toBe(false);
  });

  it('detects a brand in the path', () => {
    expect(hasBrandInPath(parts('https://example.com/paypal/login'))).toBe(true);
    expect(hasBrandInPath(parts('https://example.com/home'))).toBe(false);
  });

  it('does not match a short token inside a longer word', () => {
    expect(hasBrandInSubdomain(parts('https://money.example.com/'))).toBe(false);
  });
});

describe('isLegitBrandHost', () => {
  it('recognises legitimate eTLD+1s', () => {
    expect(isLegitBrandHost('paypal.com')).toBe(true);
    expect(isLegitBrandHost('example.com')).toBe(false);
    expect(isLegitBrandHost(null)).toBe(false);
  });
});

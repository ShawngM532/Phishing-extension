import { describe, expect, it } from 'vitest';

import {
  countCredentialTerms,
  countFinancialTerms,
  countUrlKeywords,
  countUrgencyTerms,
  CREDENTIAL_TERMS,
  FINANCIAL_TERMS,
  PHISH_URL_KEYWORDS,
  URGENCY_TERMS,
} from './keywords';

describe('keyword lists', () => {
  it.each([
    ['PHISH_URL_KEYWORDS', PHISH_URL_KEYWORDS],
    ['URGENCY_TERMS', URGENCY_TERMS],
    ['CREDENTIAL_TERMS', CREDENTIAL_TERMS],
    ['FINANCIAL_TERMS', FINANCIAL_TERMS],
  ])('%s has 20–60 lowercase entries', (_name, terms) => {
    expect(terms.length).toBeGreaterThanOrEqual(20);
    expect(terms.length).toBeLessThanOrEqual(60);
    for (const term of terms) {
      expect(term).toBe(term.toLowerCase());
    }
  });

  it('includes common obfuscations', () => {
    expect(PHISH_URL_KEYWORDS).toContain('l0gin');
    expect(PHISH_URL_KEYWORDS).toContain('secur3');
    expect(CREDENTIAL_TERMS).toContain('passw0rd');
  });
});

describe('countUrlKeywords', () => {
  it('matches keywords as substrings of the url', () => {
    expect(countUrlKeywords('https://paypal.com/login/verify')).toBeGreaterThanOrEqual(2);
    expect(countUrlKeywords('https://example.com/')).toBe(0);
  });
});

describe('text keyword counts are word-boundary aware', () => {
  it('matches login but not logistics', () => {
    expect(countCredentialTerms('Please enter your login details')).toBe(1);
    expect(countCredentialTerms('Our logistics partner')).toBe(0);
  });

  it('counts urgency phrases', () => {
    expect(countUrgencyTerms('Your account has been suspended. Verify now.')).toBe(2);
  });

  it('counts financial terms', () => {
    expect(countFinancialTerms('Your invoice payment is overdue')).toBe(3);
  });
});

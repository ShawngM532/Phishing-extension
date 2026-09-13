import { describe, expect, it } from 'vitest';

import { damerauLevenshtein, foldHomoglyphs, normalizedDistance } from './homoglyphs';

describe('foldHomoglyphs', () => {
  it.each([
    ['micros0ft', 'microsoft'],
    ['paypa1', 'paypal'],
    ['rnicrosoft', 'microsoft'],
    ['vvindows', 'windows'],
    ['secur3', 'secure'],
    ['acc0unt', 'account'],
    ['PAYPAL', 'paypal'],
    ['already', 'already'],
  ])('folds %j to %j', (input, expected) => {
    expect(foldHomoglyphs(input)).toBe(expected);
  });
});

describe('damerauLevenshtein', () => {
  it.each([
    ['paypa1', 'paypal', 1],
    ['paypal', 'paypal', 0],
    ['kitten', 'sitting', 3],
    ['ab', 'ba', 1],
    ['', 'abc', 3],
    ['abc', '', 3],
    ['micros0ft', 'microsoft', 1],
  ])('distance(%j, %j) === %i', (a, b, expected) => {
    expect(damerauLevenshtein(a, b)).toBe(expected);
  });
});

describe('normalizedDistance', () => {
  it('normalises by the longer string', () => {
    expect(normalizedDistance('paypa1', 'paypal')).toBeCloseTo(1 / 6, 6);
    expect(normalizedDistance('', '')).toBe(0);
  });
});

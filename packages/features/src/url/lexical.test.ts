import { describe, expect, it } from 'vitest';

import { FEATURE_COUNT, FEATURE_INDEX } from '../version';
import { countOccurrences, shannonEntropy, writeLexicalFeatures } from './lexical';
import { parseUrl } from './parse';

function vector(url: string): Float32Array {
  const parts = parseUrl(url);
  if (parts === null) throw new Error(`unparsable: ${url}`);
  const out = new Float32Array(FEATURE_COUNT);
  writeLexicalFeatures(out, parts, url);
  return out;
}

describe('shannonEntropy', () => {
  it.each([
    ['', 0],
    ['a', 0],
    ['aaaa', 0],
    ['abcd', 2],
    ['aabb', 1],
  ])('entropy(%j) === %s', (input, expected) => {
    expect(shannonEntropy(input)).toBeCloseTo(expected, 10);
  });
});

describe('countOccurrences', () => {
  it('counts any of the given characters', () => {
    expect(countOccurrences('a-b-c', '-')).toBe(2);
    expect(countOccurrences('a-b-c', '-c')).toBe(3);
    expect(countOccurrences('abc', 'z')).toBe(0);
  });
});

describe('lexical features', () => {
  it('measures lengths and counts', () => {
    const url = 'https://www.ex-ample123.com:8443/a/b/c.html?x=1&y=2';
    const v = vector(url);
    expect(v[FEATURE_INDEX.url_len]).toBe(url.length);
    expect(v[FEATURE_INDEX.host_len]).toBe('www.ex-ample123.com'.length);
    expect(v[FEATURE_INDEX.path_len]).toBe('/a/b/c.html'.length);
    expect(v[FEATURE_INDEX.query_len]).toBe('?x=1&y=2'.length);
    expect(v[FEATURE_INDEX.num_dots_host]).toBe(2);
    expect(v[FEATURE_INDEX.num_subdomains]).toBe(1);
    expect(v[FEATURE_INDEX.num_hyphens_host]).toBe(1);
    expect(v[FEATURE_INDEX.num_digits_host]).toBe(3);
    expect(v[FEATURE_INDEX.num_query_params]).toBe(2);
    expect(v[FEATURE_INDEX.nonstandard_port]).toBe(1);
    expect(v[FEATURE_INDEX.path_depth]).toBe(3);
    expect(v[FEATURE_INDEX.has_file_ext_html_php]).toBe(1);
  });

  it('flags an ip host', () => {
    expect(vector('http://192.168.0.1/login')[FEATURE_INDEX.host_is_ip]).toBe(1);
    expect(vector('https://example.com/')[FEATURE_INDEX.host_is_ip]).toBe(0);
  });

  it('flags an at-sign in the raw url', () => {
    expect(vector('https://user@example.com/')[FEATURE_INDEX.has_at_symbol]).toBe(1);
    expect(vector('https://example.com/')[FEATURE_INDEX.has_at_symbol]).toBe(0);
  });

  it('flags a double slash in the path', () => {
    expect(vector('https://example.com/a//b')[FEATURE_INDEX.has_double_slash_in_path]).toBe(1);
    expect(vector('https://example.com/a/b')[FEATURE_INDEX.has_double_slash_in_path]).toBe(0);
  });

  it('flags punycode', () => {
    expect(vector('https://bücher.de/')[FEATURE_INDEX.has_punycode]).toBe(1);
    expect(vector('https://example.com/')[FEATURE_INDEX.has_punycode]).toBe(0);
  });

  it('flags https', () => {
    expect(vector('https://example.com/')[FEATURE_INDEX.is_https]).toBe(1);
    expect(vector('http://example.com/')[FEATURE_INDEX.is_https]).toBe(0);
  });

  it('scores tld risk', () => {
    expect(vector('https://example.com/')[FEATURE_INDEX.tld_risk]).toBe(0);
    expect(vector('https://example.zip/')[FEATURE_INDEX.tld_risk]).toBeGreaterThan(0.5);
    expect(vector('https://example.top/')[FEATURE_INDEX.tld_risk]).toBeGreaterThan(0.5);
    expect(vector('https://example.xyz/')[FEATURE_INDEX.tld_risk]).toBeGreaterThan(0.5);
  });

  it('computes the hex ratio of path segments', () => {
    expect(vector('https://example.com/abcdef1234/login')[FEATURE_INDEX.hex_ratio_path]).toBe(0.5);
    expect(vector('https://example.com/login')[FEATURE_INDEX.hex_ratio_path]).toBe(0);
    expect(vector('https://example.com/')[FEATURE_INDEX.hex_ratio_path]).toBe(0);
  });

  it('counts special characters in path and query', () => {
    expect(vector('https://example.com/a%20b~c?d=e&f=g')[FEATURE_INDEX.num_special_chars]).toBe(5);
  });
});

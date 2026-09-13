import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { FEATURE_COUNT, FEATURE_INDEX } from '../version';
import { writeDomFeatures, type DomContext } from './structure';

function extract(html: string, url: string, overrides: Partial<DomContext> = {}): Float32Array {
  const dom = new JSDOM(html, { url });
  const out = new Float32Array(FEATURE_COUNT);
  writeDomFeatures(out, dom.window.document, {
    pageUrl: url,
    formAddedAfterLoad: false,
    isSubFrame: false,
    ...overrides,
  });
  return out;
}

describe('writeDomFeatures', () => {
  it('treats autocomplete=password as a password field', () => {
    const out = extract(
      '<html><body><form action="/x"><input type="text" autocomplete="current-password"></form></body></html>',
      'https://example.com/',
    );
    expect(out[FEATURE_INDEX.has_password_input]).toBe(1);
    expect(out[FEATURE_INDEX.password_form_action_external]).toBe(0);
  });

  it('treats a password field with no form as an empty action', () => {
    const out = extract(
      '<html><body><input type="password"></body></html>',
      'https://example.com/',
    );
    expect(out[FEATURE_INDEX.has_password_input]).toBe(1);
    expect(out[FEATURE_INDEX.password_form_action_empty_or_js]).toBe(1);
  });

  it('flags an external favicon', () => {
    const out = extract(
      '<html><head><link rel="icon" href="https://cdn.other.test/fav.ico"></head><body></body></html>',
      'https://example.com/',
    );
    expect(out[FEATURE_INDEX.favicon_external]).toBe(1);
  });

  it('does not flag a title brand on the brand domain', () => {
    const out = extract(
      '<html><head><title>PayPal</title></head><body></body></html>',
      'https://paypal.com/',
    );
    expect(out[FEATURE_INDEX.title_brand_mismatch]).toBe(0);
  });

  it('flags a copyright brand mismatch', () => {
    const out = extract(
      '<html><body><footer>© Microsoft</footer></body></html>',
      'https://example.com/',
    );
    expect(out[FEATURE_INDEX.copyright_brand_mismatch]).toBe(1);
  });

  it('reports zero ratios when there are no scripts or anchors', () => {
    const out = extract('<html><body><p>hi</p></body></html>', 'https://example.com/');
    expect(out[FEATURE_INDEX.external_script_ratio]).toBe(0);
    expect(out[FEATURE_INDEX.external_anchor_ratio]).toBe(0);
    expect(out[FEATURE_INDEX.anchor_null_ratio]).toBe(0);
  });

  it('counts inline onsubmit handlers', () => {
    const out = extract(
      '<html><body><form onsubmit="return x()" action="/a"><input type="password"></form></body></html>',
      'https://example.com/',
    );
    expect(out[FEATURE_INDEX.num_onsubmit_handlers]).toBe(1);
  });
});

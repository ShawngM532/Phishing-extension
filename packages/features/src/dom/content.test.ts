import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { FEATURE_COUNT, FEATURE_INDEX } from '../version';
import { writeContentFeatures } from './content';

function extract(html: string, url: string, lang?: string): Float32Array {
  const dom = new JSDOM(html, { url });
  if (lang !== undefined) {
    dom.window.document.documentElement.setAttribute('lang', lang);
  }
  const out = new Float32Array(FEATURE_COUNT);
  writeContentFeatures(out, dom.window.document, {
    pageUrl: url,
    formAddedAfterLoad: false,
    isSubFrame: false,
  });
  return out;
}

describe('writeContentFeatures', () => {
  it('counts keyword categories and text length', () => {
    const html =
      '<html lang="en"><body>Your account has been suspended. Verify now. Please enter your password. Your invoice payment is overdue.</body></html>';
    const out = extract(html, 'https://example.com/');
    expect(out[FEATURE_INDEX.urgency_term_count]).toBeGreaterThanOrEqual(2);
    expect(out[FEATURE_INDEX.credential_term_count]).toBeGreaterThanOrEqual(1);
    expect(out[FEATURE_INDEX.financial_term_count]).toBeGreaterThanOrEqual(3);
    expect(out[FEATURE_INDEX.visible_text_len]).toBeGreaterThan(0);
    expect(out[FEATURE_INDEX.text_to_html_ratio]).toBeGreaterThan(0);
  });

  it('prefers innerText when the browser provides it', () => {
    const dom = new JSDOM('<html lang="en"><body><p>hidden</p></body></html>', {
      url: 'https://example.com/',
    });
    Object.defineProperty(dom.window.document.body, 'innerText', {
      value: 'Your password was suspended',
      configurable: true,
    });
    const out = new Float32Array(FEATURE_COUNT);
    writeContentFeatures(out, dom.window.document, {
      pageUrl: 'https://example.com/',
      formAddedAfterLoad: false,
      isSubFrame: false,
    });
    expect(out[FEATURE_INDEX.credential_term_count]).toBeGreaterThanOrEqual(1);
  });

  it('handles a document without a body', () => {
    const dom = new JSDOM('<html lang="en"></html>', { url: 'https://example.com/' });
    dom.window.document.documentElement.removeChild(dom.window.document.body);
    const out = new Float32Array(FEATURE_COUNT);
    expect(() => {
      writeContentFeatures(out, dom.window.document, {
        pageUrl: 'https://example.com/',
        formAddedAfterLoad: false,
        isSubFrame: false,
      });
    }).not.toThrow();
    expect(out[FEATURE_INDEX.visible_text_len]).toBe(0);
  });

  it.each([
    ['https://example.de/', 'en', 1],
    ['https://example.de/', 'de', 0],
    ['https://example.com/', 'en', 0],
    ['https://example.io/', 'en', 0],
    ['https://example.de/', undefined, 0],
    ['https://example.de/', 'en-US', 1],
  ])('lang_mismatch for %s lang=%s is %i', (url, lang, expected) => {
    const out = extract('<html><body>text</body></html>', url, lang);
    expect(out[FEATURE_INDEX.lang_mismatch_tld]).toBe(expected);
  });
});

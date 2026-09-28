import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { extractStage1, FEATURE_INDEX, parseBloom } from '@sentinel/features';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installChromeMock } from './chrome-mock';

const BLOOM_PATH = fileURLToPath(new URL('../public/tranco.bloom', import.meta.url));
const bloomBytes = new Uint8Array(readFileSync(BLOOM_PATH));

describe('Tranco bloom', () => {
  it('contains well-known Tranco domains and excludes random ones', () => {
    const filter = parseBloom(bloomBytes);
    expect(filter.has('google.com')).toBe(true);
    expect(filter.has('paypal.com')).toBe(true);
    expect(filter.has('xero.com')).toBe(true);
    expect(filter.has('this-domain-is-definitely-not-in-tranco-xyz123.test')).toBe(false);
  });

  it('is under the 200 KB budget', () => {
    expect(bloomBytes.length).toBeLessThanOrEqual(200 * 1024);
  });
});

describe('bloom cache', () => {
  beforeEach(() => {
    installChromeMock();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the bundled filter and drives feature 23', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(bloomBytes))),
    );
    const mod = await import('../src/background/bloom-cache');

    await mod.initBloom();
    const filter = mod.cachedBloom();
    expect(filter).not.toBeNull();

    const trancoVector = extractStage1('https://google.com/', { bloom: filter });
    expect(trancoVector?.[FEATURE_INDEX.in_tranco_50k]).toBe(1);

    const randomVector = extractStage1('https://nope-not-tranco-xyz123.test/', { bloom: filter });
    expect(randomVector?.[FEATURE_INDEX.in_tranco_50k]).toBe(0);
  });

  it('falls back to null and warns once when the filter is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('missing', { status: 404 }))),
    );
    const mod = await import('../src/background/bloom-cache');

    await mod.initBloom();
    expect(mod.cachedBloom()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('exposes a readiness barrier and a test setter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(bloomBytes))),
    );
    const mod = await import('../src/background/bloom-cache');

    await mod.bloomReady();
    expect(mod.cachedBloom()).not.toBeNull();

    mod.setCachedBloom(null);
    expect(mod.cachedBloom()).toBeNull();
  });
});

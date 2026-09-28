import { parseBloom, type BloomFilter } from '@sentinel/features';

/**
 * Loads the bundled Tranco top-50k Bloom filter once, at service-worker startup.
 *
 * The filter backs feature #23 `in_tranco_50k`. If it is missing or corrupt the
 * extension keeps working; the feature simply reads 0 and we warn once.
 */
let bloom: BloomFilter | null = null;
let initPromise: Promise<void> | null = null;
let warned = false;

export function initBloom(): Promise<void> {
  initPromise ??= (async () => {
    try {
      const response = await fetch(chrome.runtime.getURL('tranco.bloom'));
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      bloom = parseBloom(bytes);
    } catch (error) {
      if (!warned) {
        console.warn('[sentinel] Tranco bloom unavailable; in_tranco_50k will be 0', error);
        warned = true;
      }
      bloom = null;
    }
  })();
  return initPromise;
}

export function bloomReady(): Promise<void> {
  return initPromise ?? initBloom();
}

export function cachedBloom(): BloomFilter | null {
  return bloom;
}

/** Test helper: inject a filter without touching the network. */
export function setCachedBloom(filter: BloomFilter | null): void {
  bloom = filter;
}

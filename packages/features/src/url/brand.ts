import brands from '../data/brands.json';
import { FEATURE_INDEX } from '../version';
import { foldHomoglyphs, normalizedDistance } from './homoglyphs';
import type { UrlParts } from './parse';

export interface BrandEntry {
  token: string;
  etld1s: string[];
}

export const BRANDS: readonly BrandEntry[] = brands;

interface FoldedBrand {
  token: string;
  folded: string;
}

const FOLDED_BRANDS: readonly FoldedBrand[] = BRANDS.map((brand) => ({
  token: brand.token,
  folded: foldHomoglyphs(brand.token),
}));

/** Brands bucketed by the first folded character, so lookalike checks only scan a handful. */
const FOLDED_BY_FIRST: ReadonlyMap<string, readonly FoldedBrand[]> = (() => {
  const map = new Map<string, FoldedBrand[]>();
  for (const brand of FOLDED_BRANDS) {
    const key = brand.folded[0] ?? '';
    const bucket = map.get(key);
    if (bucket === undefined) {
      map.set(key, [brand]);
    } else {
      bucket.push(brand);
    }
  }
  return map;
})();

const LOOKALIKE_CACHE = new Map<string, number>();
const LOOKALIKE_CACHE_LIMIT = 4096;

const LEGIT_ETLD1: ReadonlySet<string> = new Set(BRANDS.flatMap((brand) => brand.etld1s));

const BRAND_ETLD1S: ReadonlyMap<string, readonly string[]> = new Map(
  BRANDS.map((brand) => [brand.token, brand.etld1s]),
);

export function brandEtld1s(token: string): readonly string[] {
  return BRAND_ETLD1S.get(token) ?? [];
}

const LOOKALIKE_THRESHOLD = 0.4;

export function isLegitBrandHost(etld1: string | null): boolean {
  return etld1 !== null && LEGIT_ETLD1.has(etld1);
}

/** True when a folded brand token appears as a whole segment, or as a substring for longer tokens. */
function textHasToken(foldedText: string, foldedToken: string): boolean {
  if (foldedText === foldedToken) return true;
  const segments = foldedText.split(/[^a-z0-9]+/);
  if (segments.includes(foldedToken)) return true;
  return foldedToken.length >= 5 && foldedText.includes(foldedToken);
}

export function hasBrandInSubdomain(parts: UrlParts): boolean {
  if (parts.subdomainLabels.length === 0) return false;
  const folded = foldHomoglyphs(parts.subdomainLabels.join('.'));
  return FOLDED_BRANDS.some((brand) => textHasToken(folded, brand.folded));
}

export function hasBrandInPath(parts: UrlParts): boolean {
  const folded = foldHomoglyphs(parts.pathname);
  return FOLDED_BRANDS.some((brand) => textHasToken(folded, brand.folded));
}

/** Returns the first brand token present in arbitrary text, or null. */
export function findBrandToken(text: string): string | null {
  if (text.length === 0) return null;
  const folded = foldHomoglyphs(text);
  for (const brand of FOLDED_BRANDS) {
    if (textHasToken(folded, brand.folded)) return brand.token;
  }
  return null;
}

/**
 * Minimum normalised edit distance between a second-level-domain segment and any brand token.
 * 0 means the host is a legitimate eTLD+1 for a known brand; 1 means no brand is within 0.4.
 * Distance is measured on the raw segment so that character substitutions (e.g. `paypa1`)
 * remain visible as a small non-zero signal.
 */
export function brandLookalikeHost(parts: UrlParts): number {
  if (parts.etld1 === null) return 1;
  if (isLegitBrandHost(parts.etld1)) return 0;

  const cached = LOOKALIKE_CACHE.get(parts.etld1);
  if (cached !== undefined) return cached;

  const suffix = parts.publicSuffix;
  const sld =
    suffix !== null && parts.etld1.endsWith(`.${suffix}`)
      ? parts.etld1.slice(0, parts.etld1.length - suffix.length - 1)
      : parts.etld1;

  const segments = sld.split(/[-_]/).filter((segment) => segment.length > 0);
  let best = 1;

  for (const segment of segments) {
    // Pure-numeric segments are never brand lookalikes (brand tokens are alphabetic).
    if (/^\d+$/.test(segment)) continue;
    const foldedSegment = foldHomoglyphs(segment);
    const candidates = FOLDED_BY_FIRST.get(foldedSegment[0] ?? '') ?? [];
    for (const brand of candidates) {
      const maxLen = Math.max(segment.length, brand.folded.length);
      if (maxLen === 0) continue;
      if (Math.abs(segment.length - brand.folded.length) / maxLen > LOOKALIKE_THRESHOLD) continue;
      const distance = normalizedDistance(segment, brand.folded);
      if (distance < best) best = distance;
      if (best === 0) break;
    }
    if (best === 0) break;
  }

  const result = best < LOOKALIKE_THRESHOLD ? best : 1;
  if (LOOKALIKE_CACHE.size >= LOOKALIKE_CACHE_LIMIT) {
    const oldest = LOOKALIKE_CACHE.keys().next().value;
    if (oldest !== undefined) LOOKALIKE_CACHE.delete(oldest);
  }
  LOOKALIKE_CACHE.set(parts.etld1, result);
  return result;
}

/** Writes brand-related URL features (PRD §10.1 indices 18–20). */
export function writeBrandFeatures(out: Float32Array, parts: UrlParts): void {
  out[FEATURE_INDEX.brand_in_subdomain] = hasBrandInSubdomain(parts) ? 1 : 0;
  out[FEATURE_INDEX.brand_in_path] = hasBrandInPath(parts) ? 1 : 0;
  out[FEATURE_INDEX.brand_lookalike_host] = brandLookalikeHost(parts);
}

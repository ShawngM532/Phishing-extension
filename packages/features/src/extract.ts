import type { BloomFilter } from './data/bloom';
import { countUrlKeywords } from './data/keywords';
import { isUrlShortener } from './data/shorteners';
import { writeContentFeatures } from './dom/content';
import { writeDomFeatures, type DomContext } from './dom/structure';
import { writeBrandFeatures } from './url/brand';
import { writeLexicalFeatures } from './url/lexical';
import { parseUrl } from './url/parse';
import { FEATURE_COUNT, FEATURE_INDEX } from './version';

export interface ExtractOptions {
  /** Tranco Bloom filter for feature 23. When absent the feature is 0. */
  bloom?: BloomFilter | null;
  formAddedAfterLoad?: boolean;
  isSubFrame?: boolean;
  /** Side channel for non-fatal extraction errors. */
  warnings?: string[];
}

function warn(warnings: string[] | undefined, label: string, error: unknown): void {
  warnings?.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
}

function writeUrlFeatures(
  out: Float32Array,
  url: string,
  options: ExtractOptions,
  warnings: string[] | undefined,
): void {
  const parts = parseUrl(url);
  if (parts === null) throw new Error(`unscorable url: ${url}`);

  try {
    writeLexicalFeatures(out, parts, url);
  } catch (error) {
    warn(warnings, 'lexical', error);
  }
  try {
    writeBrandFeatures(out, parts);
  } catch (error) {
    warn(warnings, 'brand', error);
  }
  try {
    out[FEATURE_INDEX.is_url_shortener] = isUrlShortener(parts.etld1, parts.hostname) ? 1 : 0;
  } catch (error) {
    warn(warnings, 'shortener', error);
  }
  try {
    out[FEATURE_INDEX.phish_keyword_count] = countUrlKeywords(url);
  } catch (error) {
    warn(warnings, 'keywords', error);
  }
  try {
    out[FEATURE_INDEX.in_tranco_50k] =
      options.bloom?.has(parts.etld1 ?? parts.hostname) === true ? 1 : 0;
  } catch (error) {
    warn(warnings, 'tranco', error);
  }
}

/** Extracts URL-only features (indices 0–26). Returns null for unscorable URLs. */
export function extractStage1(url: string, options: ExtractOptions = {}): Float32Array | null {
  const out = new Float32Array(FEATURE_COUNT);
  try {
    writeUrlFeatures(out, url, options, options.warnings);
  } catch (error) {
    options.warnings?.push(error instanceof Error ? error.message : String(error));
    return null;
  }
  return out;
}

/** Extracts URL + DOM + content features. Returns null for unscorable URLs. */
export function extractStage2(
  url: string,
  doc: Document,
  options: ExtractOptions = {},
): Float32Array | null {
  const out = new Float32Array(FEATURE_COUNT);
  try {
    writeUrlFeatures(out, url, options, options.warnings);
  } catch (error) {
    options.warnings?.push(error instanceof Error ? error.message : String(error));
    return null;
  }

  const ctx: DomContext = {
    pageUrl: url,
    formAddedAfterLoad: options.formAddedAfterLoad ?? false,
    isSubFrame: options.isSubFrame ?? false,
  };

  try {
    writeDomFeatures(out, doc, ctx);
  } catch (error) {
    warn(options.warnings, 'dom', error);
  }
  try {
    writeContentFeatures(out, doc, ctx);
  } catch (error) {
    warn(options.warnings, 'content', error);
  }

  return out;
}

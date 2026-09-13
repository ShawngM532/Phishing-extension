import tldRisk from '../data/tld-risk.json';
import { FEATURE_INDEX } from '../version';
import type { UrlParts } from './parse';

/** Reused across calls; extraction is synchronous so there is no re-entrancy. */
const ENTROPY_COUNTS = new Map<string, number>();

/** Shannon entropy of a string in bits (base 2). Empty/single-character input is 0. */
export function shannonEntropy(input: string): number {
  if (input.length <= 1) return 0;
  ENTROPY_COUNTS.clear();
  for (const char of input) {
    ENTROPY_COUNTS.set(char, (ENTROPY_COUNTS.get(char) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of ENTROPY_COUNTS.values()) {
    const p = count / input.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export function countOccurrences(input: string, chars: string): number {
  let total = 0;
  for (const char of input) {
    if (chars.includes(char)) total += 1;
  }
  return total;
}

/** Risk weight for a host's public suffix. Falls back to the last label, then to the default. */
export function tldRiskFor(parts: UrlParts): number {
  const weights = tldRisk.weights as Record<string, number>;
  const candidates = [parts.publicSuffix, parts.hostname.split('.').pop()];
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && candidate in weights) {
      return weights[candidate] ?? tldRisk.default;
    }
  }
  return tldRisk.default;
}

function pathSegments(pathname: string): string[] {
  return pathname.split('/').filter((segment) => segment.length > 0);
}

/** Counts non-empty `k=v&k2=v2` pairs, matching URLSearchParams.size. */
function countQueryParams(query: string): number {
  if (query.length === 0) return 0;
  let count = 0;
  for (const segment of query.split('&')) {
    if (segment.length > 0) count += 1;
  }
  return count;
}

function hexRatioPath(pathname: string): number {
  const segments = pathSegments(pathname);
  if (segments.length === 0) return 0;
  const hexSegments = segments.filter(
    (segment) => segment.length >= 4 && /^[0-9a-f]+$/i.test(segment),
  ).length;
  return hexSegments / segments.length;
}

const HTML_PHP_EXTENSION = /\.(?:html?|php|aspx?|jsp)$/i;

/** Writes URL lexical features (PRD §10.1 indices 0–17, 24–26) into `out`. */
export function writeLexicalFeatures(out: Float32Array, parts: UrlParts, rawUrl: string): void {
  const query = parts.search.startsWith('?') ? parts.search.slice(1) : parts.search;

  out[FEATURE_INDEX.url_len] = rawUrl.length;
  out[FEATURE_INDEX.host_len] = parts.hostname.length;
  out[FEATURE_INDEX.path_len] = parts.pathname.length;
  out[FEATURE_INDEX.query_len] = parts.search.length;
  out[FEATURE_INDEX.num_dots_host] = countOccurrences(parts.hostname, '.');
  out[FEATURE_INDEX.num_subdomains] = parts.subdomainLabels.length;
  out[FEATURE_INDEX.num_hyphens_host] = countOccurrences(parts.hostname, '-');
  out[FEATURE_INDEX.num_digits_host] = countOccurrences(parts.hostname, '0123456789');
  out[FEATURE_INDEX.host_is_ip] = parts.isIp ? 1 : 0;
  out[FEATURE_INDEX.has_at_symbol] = rawUrl.includes('@') ? 1 : 0;
  out[FEATURE_INDEX.has_double_slash_in_path] = parts.pathname.includes('//') ? 1 : 0;
  out[FEATURE_INDEX.num_query_params] = countQueryParams(query);
  out[FEATURE_INDEX.has_punycode] = parts.isPunycode ? 1 : 0;
  out[FEATURE_INDEX.host_entropy] = shannonEntropy(parts.hostname);
  out[FEATURE_INDEX.tld_risk] = tldRiskFor(parts);
  out[FEATURE_INDEX.num_special_chars] = countOccurrences(
    `${parts.pathname}${parts.search}`,
    '%~=&',
  );
  out[FEATURE_INDEX.is_https] = parts.protocol === 'https:' ? 1 : 0;
  out[FEATURE_INDEX.nonstandard_port] = parts.port !== '' ? 1 : 0;
  out[FEATURE_INDEX.path_depth] = pathSegments(parts.pathname).length;
  out[FEATURE_INDEX.has_file_ext_html_php] = HTML_PHP_EXTENSION.test(parts.pathname) ? 1 : 0;
  out[FEATURE_INDEX.hex_ratio_path] = hexRatioPath(parts.pathname);
}

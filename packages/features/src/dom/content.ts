import { countCredentialTerms, countFinancialTerms, countUrgencyTerms } from '../data/keywords';
import { parseUrl } from '../url/parse';
import { FEATURE_INDEX } from '../version';
import type { DomContext } from './structure';

const MAX_VISIBLE_TEXT = 50_000;

/** Dominant language per ccTLD. Multilingual countries are intentionally omitted. */
const CCTLD_LANGUAGE: Readonly<Record<string, string>> = {
  nz: 'en',
  au: 'en',
  uk: 'en',
  ie: 'en',
  us: 'en',
  ca: 'en',
  za: 'en',
  in: 'en',
  sg: 'en',
  de: 'de',
  at: 'de',
  fr: 'fr',
  be: 'nl',
  nl: 'nl',
  es: 'es',
  mx: 'es',
  ar: 'es',
  cl: 'es',
  co: 'es',
  it: 'it',
  pt: 'pt',
  br: 'pt',
  jp: 'ja',
  cn: 'zh',
  tw: 'zh',
  hk: 'zh',
  kr: 'ko',
  ru: 'ru',
  pl: 'pl',
  cz: 'cs',
  hu: 'hu',
  ro: 'ro',
  gr: 'el',
  tr: 'tr',
  se: 'sv',
  no: 'no',
  dk: 'da',
  fi: 'fi',
  th: 'th',
  vn: 'vi',
  id: 'id',
  il: 'he',
  sa: 'ar',
  ae: 'ar',
  eg: 'ar',
};

/** Visible page text, lowercased and capped. Falls back to textContent when innerText is absent. */
function visibleText(doc: Document): string {
  const body = doc.body as HTMLElement | null;
  if (body === null) return '';

  const innerText = (body as { innerText?: unknown }).innerText;
  const fallback = body.textContent as string | null;
  const raw = typeof innerText === 'string' && innerText.length > 0 ? innerText : (fallback ?? '');

  return raw.slice(0, MAX_VISIBLE_TEXT).toLowerCase();
}

/** Writes content semantics features (PRD §10.3 indices 47–52) into `out`. */
export function writeContentFeatures(out: Float32Array, doc: Document, ctx: DomContext): void {
  const text = visibleText(doc);

  out[FEATURE_INDEX.urgency_term_count] = countUrgencyTerms(text);
  out[FEATURE_INDEX.credential_term_count] = countCredentialTerms(text);
  out[FEATURE_INDEX.financial_term_count] = countFinancialTerms(text);
  out[FEATURE_INDEX.visible_text_len] = text.length;

  const html = doc.documentElement.outerHTML;
  out[FEATURE_INDEX.text_to_html_ratio] = html.length === 0 ? 0 : text.length / html.length;

  const lang = (doc.documentElement.getAttribute('lang') ?? '').toLowerCase();
  const primary = lang.split('-')[0] ?? '';
  const tld = parseUrl(ctx.pageUrl)?.publicSuffix?.split('.').pop() ?? '';
  const expected = CCTLD_LANGUAGE[tld];
  out[FEATURE_INDEX.lang_mismatch_tld] =
    primary !== '' && expected !== undefined && primary !== expected ? 1 : 0;
}

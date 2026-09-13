import { FEATURE_INDEX } from '@sentinel/features';

import { reasonText } from './copy';
import type { ScoreContext } from './types';

export interface Rule {
  code: string;
  weight: number;
  test: (features: Float32Array, ctx: ScoreContext) => boolean;
  human: (ctx: ScoreContext) => string;
}

function rule(
  code: string,
  weight: number,
  test: (features: Float32Array, ctx: ScoreContext) => boolean,
): Rule {
  return { code, weight, test, human: (ctx) => reasonText(code, ctx) };
}

/** Safe feature read: missing indices read as 0. */
function feat(features: Float32Array, index: number): number {
  return features[index] ?? 0;
}

/**
 * Weighted heuristic rules. Weights are tuned so a typical phishing page clears
 * 0.75 under noisy-OR while a benign page stays well under 0.2.
 */
export const RULES: readonly Rule[] = [
  // URL signals
  rule('URL_IP_HOST', 0.5, (f) => feat(f, FEATURE_INDEX.host_is_ip) === 1),
  rule('URL_PUNYCODE', 0.35, (f) => feat(f, FEATURE_INDEX.has_punycode) === 1),
  rule(
    'URL_BRAND_LOOKALIKE',
    0.6,
    (f) =>
      feat(f, FEATURE_INDEX.brand_lookalike_host) > 0 &&
      feat(f, FEATURE_INDEX.brand_lookalike_host) < 0.3,
  ),
  rule(
    'URL_BRAND_LOOKALIKE_WEAK',
    0.35,
    (f) =>
      feat(f, FEATURE_INDEX.brand_lookalike_host) >= 0.3 &&
      feat(f, FEATURE_INDEX.brand_lookalike_host) < 0.4,
  ),
  rule('URL_BRAND_IN_SUBDOMAIN', 0.3, (f) => feat(f, FEATURE_INDEX.brand_in_subdomain) === 1),
  rule('URL_BRAND_IN_PATH', 0.25, (f) => feat(f, FEATURE_INDEX.brand_in_path) === 1),
  rule('URL_SHORTENER', 0.25, (f) => feat(f, FEATURE_INDEX.is_url_shortener) === 1),
  rule('URL_MANY_KEYWORDS', 0.3, (f) => feat(f, FEATURE_INDEX.phish_keyword_count) >= 2),
  rule(
    'URL_NOT_TRANCO',
    0.15,
    (f) =>
      feat(f, FEATURE_INDEX.in_tranco_50k) === 0 && feat(f, FEATURE_INDEX.brand_lookalike_host) < 1,
  ),
  rule('URL_NO_HTTPS', 0.25, (f) => feat(f, FEATURE_INDEX.is_https) === 0),
  rule('URL_RISKY_TLD', 0.3, (f) => feat(f, FEATURE_INDEX.tld_risk) >= 0.5),
  rule('URL_AT_SYMBOL', 0.3, (f) => feat(f, FEATURE_INDEX.has_at_symbol) === 1),
  rule('URL_NONSTANDARD_PORT', 0.2, (f) => feat(f, FEATURE_INDEX.nonstandard_port) === 1),
  rule('URL_LONG_HOST', 0.15, (f) => feat(f, FEATURE_INDEX.host_len) > 30),
  rule('URL_MANY_SUBDOMAINS', 0.2, (f) => feat(f, FEATURE_INDEX.num_subdomains) >= 3),
  rule('URL_ENTROPY', 0.2, (f) => feat(f, FEATURE_INDEX.host_entropy) > 3.5),
  rule('URL_HEX_PATH', 0.2, (f) => feat(f, FEATURE_INDEX.hex_ratio_path) > 0.4),
  rule('URL_EXE_EXT', 0.1, (f) => feat(f, FEATURE_INDEX.has_file_ext_html_php) === 1),

  // DOM signals
  rule(
    'DOM_PASSWORD_EXTERNAL_ACTION',
    0.7,
    (f) => feat(f, FEATURE_INDEX.password_form_action_external) === 1,
  ),
  rule(
    'DOM_PASSWORD_EMPTY_ACTION',
    0.3,
    (f) => feat(f, FEATURE_INDEX.password_form_action_empty_or_js) === 1,
  ),
  rule('DOM_PASSWORD_ON_HTTP', 0.5, (f) => feat(f, FEATURE_INDEX.login_form_on_http) === 1),
  rule('DOM_TITLE_BRAND_MISMATCH', 0.6, (f) => feat(f, FEATURE_INDEX.title_brand_mismatch) === 1),
  rule(
    'DOM_COPYRIGHT_BRAND_MISMATCH',
    0.5,
    (f) => feat(f, FEATURE_INDEX.copyright_brand_mismatch) === 1,
  ),
  rule(
    'DOM_EXTERNAL_SCRIPT_RATIO',
    0.15,
    (f) => feat(f, FEATURE_INDEX.external_script_ratio) > 0.8,
  ),
  rule('DOM_HIDDEN_INPUTS', 0.15, (f) => feat(f, FEATURE_INDEX.num_hidden_inputs) >= 3),
  rule('DOM_FORM_ADDED_AFTER_LOAD', 0.3, (f) => feat(f, FEATURE_INDEX.form_added_after_load) === 1),
  rule('DOM_META_REFRESH', 0.2, (f) => feat(f, FEATURE_INDEX.has_meta_refresh) === 1),
  rule('DOM_MANY_IFRAMES', 0.2, (f) => feat(f, FEATURE_INDEX.num_iframes) >= 5),

  // Content signals
  rule('CONTENT_URGENCY', 0.35, (f) => feat(f, FEATURE_INDEX.urgency_term_count) >= 2),
  rule('CONTENT_CREDENTIAL', 0.3, (f) => feat(f, FEATURE_INDEX.credential_term_count) >= 2),
  rule('CONTENT_FINANCIAL', 0.2, (f) => feat(f, FEATURE_INDEX.financial_term_count) >= 2),
  rule('CONTENT_LANG_MISMATCH', 0.1, (f) => feat(f, FEATURE_INDEX.lang_mismatch_tld) === 1),
];

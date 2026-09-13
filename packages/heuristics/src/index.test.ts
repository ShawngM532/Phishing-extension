import { describe, expect, it } from 'vitest';

import { COPY, RULES, scoreHeuristic, toVerdict, hardOverride } from './index';
import { FEATURE_INDEX } from '@sentinel/features';

const CONTEXT = { etld1: 'example.com', brandToken: 'paypal' };

function safeVector(): Float32Array {
  const vector = new Float32Array(53);
  vector[FEATURE_INDEX.is_https] = 1;
  vector[FEATURE_INDEX.in_tranco_50k] = 1;
  vector[FEATURE_INDEX.brand_lookalike_host] = 1;
  return vector;
}

/** How to make each rule fire from the safe vector. */
const TRIGGERS: Record<string, (vector: Float32Array) => void> = {
  URL_IP_HOST: (v) => (v[FEATURE_INDEX.host_is_ip] = 1),
  URL_PUNYCODE: (v) => (v[FEATURE_INDEX.has_punycode] = 1),
  URL_BRAND_LOOKALIKE: (v) => (v[FEATURE_INDEX.brand_lookalike_host] = 0.2),
  URL_BRAND_LOOKALIKE_WEAK: (v) => (v[FEATURE_INDEX.brand_lookalike_host] = 0.35),
  URL_BRAND_IN_SUBDOMAIN: (v) => (v[FEATURE_INDEX.brand_in_subdomain] = 1),
  URL_BRAND_IN_PATH: (v) => (v[FEATURE_INDEX.brand_in_path] = 1),
  URL_SHORTENER: (v) => (v[FEATURE_INDEX.is_url_shortener] = 1),
  URL_MANY_KEYWORDS: (v) => (v[FEATURE_INDEX.phish_keyword_count] = 2),
  URL_NOT_TRANCO: (v) => {
    v[FEATURE_INDEX.in_tranco_50k] = 0;
    v[FEATURE_INDEX.brand_lookalike_host] = 0.2;
  },
  URL_NO_HTTPS: (v) => (v[FEATURE_INDEX.is_https] = 0),
  URL_RISKY_TLD: (v) => (v[FEATURE_INDEX.tld_risk] = 0.6),
  URL_AT_SYMBOL: (v) => (v[FEATURE_INDEX.has_at_symbol] = 1),
  URL_NONSTANDARD_PORT: (v) => (v[FEATURE_INDEX.nonstandard_port] = 1),
  URL_LONG_HOST: (v) => (v[FEATURE_INDEX.host_len] = 40),
  URL_MANY_SUBDOMAINS: (v) => (v[FEATURE_INDEX.num_subdomains] = 3),
  URL_ENTROPY: (v) => (v[FEATURE_INDEX.host_entropy] = 4),
  URL_HEX_PATH: (v) => (v[FEATURE_INDEX.hex_ratio_path] = 0.5),
  URL_EXE_EXT: (v) => (v[FEATURE_INDEX.has_file_ext_html_php] = 1),
  DOM_PASSWORD_EXTERNAL_ACTION: (v) => (v[FEATURE_INDEX.password_form_action_external] = 1),
  DOM_PASSWORD_EMPTY_ACTION: (v) => (v[FEATURE_INDEX.password_form_action_empty_or_js] = 1),
  DOM_PASSWORD_ON_HTTP: (v) => (v[FEATURE_INDEX.login_form_on_http] = 1),
  DOM_TITLE_BRAND_MISMATCH: (v) => (v[FEATURE_INDEX.title_brand_mismatch] = 1),
  DOM_COPYRIGHT_BRAND_MISMATCH: (v) => (v[FEATURE_INDEX.copyright_brand_mismatch] = 1),
  DOM_EXTERNAL_SCRIPT_RATIO: (v) => (v[FEATURE_INDEX.external_script_ratio] = 0.9),
  DOM_HIDDEN_INPUTS: (v) => (v[FEATURE_INDEX.num_hidden_inputs] = 3),
  DOM_FORM_ADDED_AFTER_LOAD: (v) => (v[FEATURE_INDEX.form_added_after_load] = 1),
  DOM_META_REFRESH: (v) => (v[FEATURE_INDEX.has_meta_refresh] = 1),
  DOM_MANY_IFRAMES: (v) => (v[FEATURE_INDEX.num_iframes] = 5),
  CONTENT_URGENCY: (v) => (v[FEATURE_INDEX.urgency_term_count] = 2),
  CONTENT_CREDENTIAL: (v) => (v[FEATURE_INDEX.credential_term_count] = 2),
  CONTENT_FINANCIAL: (v) => (v[FEATURE_INDEX.financial_term_count] = 2),
  CONTENT_LANG_MISMATCH: (v) => (v[FEATURE_INDEX.lang_mismatch_tld] = 1),
};

describe('rules', () => {
  it.each(RULES.map((rule) => [rule.code, rule] as const))(
    '%s has a firing and a non-firing vector',
    (code, rule) => {
      const trigger = TRIGGERS[code];
      expect(trigger, `no trigger defined for ${code}`).toBeDefined();

      const safe = safeVector();
      expect(rule.test(safe, CONTEXT)).toBe(false);

      const firing = safeVector();
      trigger?.(firing);
      expect(rule.test(firing, CONTEXT)).toBe(true);
    },
  );

  it('every rule has copy without jargon', () => {
    for (const rule of RULES) {
      expect(COPY[rule.code]).toBeDefined();
      const text = rule.human(CONTEXT).toLowerCase();
      expect(text).not.toMatch(/entropy|etld|heuristic/);
      expect(text.length).toBeGreaterThan(0);
    }
  });
});

describe('scoreHeuristic', () => {
  it('is 0 when nothing fires', () => {
    expect(scoreHeuristic(safeVector(), CONTEXT).score).toBe(0);
  });

  it('never decreases when a rule is added', () => {
    const a = safeVector();
    a[FEATURE_INDEX.host_is_ip] = 1;
    const b = safeVector();
    b[FEATURE_INDEX.host_is_ip] = 1;
    b[FEATURE_INDEX.password_form_action_external] = 1;
    expect(scoreHeuristic(b, CONTEXT).score).toBeGreaterThanOrEqual(
      scoreHeuristic(a, CONTEXT).score,
    );
  });

  it('sorts reasons by weight descending', () => {
    const vector = safeVector();
    vector[FEATURE_INDEX.host_is_ip] = 1;
    vector[FEATURE_INDEX.password_form_action_external] = 1;
    vector[FEATURE_INDEX.title_brand_mismatch] = 1;
    const { reasons } = scoreHeuristic(vector, CONTEXT);
    const weights = reasons.map((reason) => reason.weight);
    expect([...weights].sort((x, y) => y - x)).toEqual(weights);
  });

  it('reaches HIGH for a typical phishing page', () => {
    const vector = safeVector();
    vector[FEATURE_INDEX.brand_lookalike_host] = 0.2;
    vector[FEATURE_INDEX.has_password_input] = 1;
    vector[FEATURE_INDEX.password_form_action_external] = 1;
    vector[FEATURE_INDEX.title_brand_mismatch] = 1;
    const verdict = toVerdict({
      ...scoreHeuristic(vector, CONTEXT),
      engine: 'heuristic',
      extractorVersion: 1,
    });
    expect(verdict.level).toBe('HIGH');
  });

  it('stays LOW for a benign page', () => {
    const verdict = toVerdict({
      ...scoreHeuristic(safeVector(), CONTEXT),
      engine: 'heuristic',
      extractorVersion: 1,
    });
    expect(verdict.level).toBe('LOW');
  });
});

describe('hardOverride', () => {
  it('forces HIGH for an ip host with a password field', () => {
    const vector = safeVector();
    vector[FEATURE_INDEX.host_is_ip] = 1;
    vector[FEATURE_INDEX.has_password_input] = 1;
    expect(hardOverride(vector)).toBe('HIGH');
  });

  it('forces HIGH for punycode plus brand in subdomain', () => {
    const vector = safeVector();
    vector[FEATURE_INDEX.has_punycode] = 1;
    vector[FEATURE_INDEX.brand_in_subdomain] = 1;
    expect(hardOverride(vector)).toBe('HIGH');
  });

  it('forces HIGH for a strong lookalike with a password field', () => {
    const vector = safeVector();
    vector[FEATURE_INDEX.brand_lookalike_host] = 0.1;
    vector[FEATURE_INDEX.has_password_input] = 1;
    expect(hardOverride(vector)).toBe('HIGH');
  });

  it('forces MEDIUM for an external password form action', () => {
    const vector = safeVector();
    vector[FEATURE_INDEX.password_form_action_external] = 1;
    expect(hardOverride(vector)).toBe('MEDIUM');
  });

  it('returns null for a benign vector', () => {
    expect(hardOverride(safeVector())).toBeNull();
  });
});

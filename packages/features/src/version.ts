/**
 * Feature specification version. Bump whenever the meaning of any feature changes.
 * The model is only valid for a matching extractor version (checked by the WASM engine).
 */
export const EXTRACTOR_VERSION = 1;

/** Number of features in the fixed-order vector (PRD §10). */
export const FEATURE_COUNT = 53;

/** Fixed feature order. Index in this array is the index in the extracted vector. */
export const FEATURE_NAMES = [
  // URL lexical (stage 1 + 2)
  'url_len',
  'host_len',
  'path_len',
  'query_len',
  'num_dots_host',
  'num_subdomains',
  'num_hyphens_host',
  'num_digits_host',
  'host_is_ip',
  'has_at_symbol',
  'has_double_slash_in_path',
  'num_query_params',
  'has_punycode',
  'host_entropy',
  'tld_risk',
  'num_special_chars',
  'is_https',
  'nonstandard_port',
  'brand_in_subdomain',
  'brand_in_path',
  'brand_lookalike_host',
  'is_url_shortener',
  'phish_keyword_count',
  'in_tranco_50k',
  'path_depth',
  'has_file_ext_html_php',
  'hex_ratio_path',
  // DOM structure (stage 2 only)
  'num_forms',
  'has_password_input',
  'password_form_action_external',
  'password_form_action_empty_or_js',
  'num_external_scripts',
  'external_script_ratio',
  'num_iframes',
  'num_hidden_inputs',
  'num_anchors',
  'external_anchor_ratio',
  'anchor_null_ratio',
  'favicon_external',
  'has_meta_refresh',
  'title_brand_mismatch',
  'copyright_brand_mismatch',
  'login_form_on_http',
  'dom_node_count',
  'form_added_after_load',
  'password_field_in_iframe',
  'num_onsubmit_handlers',
  // Content semantics (stage 2 only)
  'urgency_term_count',
  'credential_term_count',
  'financial_term_count',
  'visible_text_len',
  'text_to_html_ratio',
  'lang_mismatch_tld',
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

/** Index lookup for a feature name. */
export const FEATURE_INDEX: Readonly<Record<FeatureName, number>> = Object.freeze(
  FEATURE_NAMES.reduce<Record<string, number>>((acc, name, index) => {
    acc[name] = index;
    return acc;
  }, {}) as Record<FeatureName, number>,
);

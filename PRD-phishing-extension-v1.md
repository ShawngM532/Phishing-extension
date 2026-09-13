# Product Requirements Document — Real-Time Phishing Detection Extension (V0 → V1)

**Codename:** Sentinel (placeholder)
**Owner:** Shawn Mathew
**Status:** Draft v1.0 — 14 Sep 2026
**Scope:** Everything up to and including V1 (client-only ML extension). V2 (hybrid backend, enterprise console) and V3 (multi-modal) are explicitly out of scope.

---

## 1. Problem

Phishing still works because the warning arrives too late or not at all. Browser safe-browsing lists lag zero-day pages by hours to days, corporate email filters miss anything delivered over chat/SMS/QR, and users have been trained to click through vague warnings.

The gap: **nothing sits at the exact moment a user is about to type a password into a page and asks "is this page what it claims to be?"** — using the page itself as evidence, locally, in under a second.

## 2. Vision

A Chrome (MV3) extension that intercepts every navigation, extracts URL + DOM + content signals on-device, scores them with a local model, and surfaces a LOW / MEDIUM / HIGH verdict before a credential is submitted. No URL or page content ever leaves the browser in V1.

## 3. Goals and success metrics (V1)

| Goal | Metric | Target |
|---|---|---|
| Catch phishing before submit | Recall on held-out phishing set | ≥ 95% |
| Don't annoy users | False positive rate on Tranco top-10k benign | ≤ 2% |
| Zero-day coverage | Recall on phishing URLs first seen ≥ 14 days after training cutoff | ≥ 90% |
| Feel instant | URL-stage verdict p95 (navigation → badge) | ≤ 50 ms |
| Feel instant | Full verdict p95 (DOM ready → banner) | ≤ 400 ms |
| Stay light | Extension steady-state memory (service worker + one content script) | ≤ 60 MB |
| Stay private | Bytes sent off-device by the extension | 0 |
| Users heed HIGH | Click-through rate on HIGH interstitial in usability tests | ≤ 15% |

## 4. Non-goals (V1)

- No backend, no accounts, no telemetry uploads, no threat-intel API calls.
- No screenshot / visual similarity models.
- No Firefox / Safari builds (Chromium-family only: Chrome, Edge, Brave).
- No enterprise policy distribution or admin console.
- No email-client integration; "check a link" is a manual paste box only.
- No attempt to detect malware, drive-by downloads, or scam content that isn't credential/payment phishing.

## 5. Personas

**P1 — Individual power user (primary for V1).** Security-aware, installs from the Web Store, wants a second opinion on links from chat and email. Tolerates zero false positives on the sites they use daily.

**P2 — Small business staff (target for V2, design for now).** Non-technical, uses Xero/Gmail/Microsoft 365/bank portals daily. Needs blocking to be the default on HIGH and a plain-English reason.

**P3 — IT admin at an SME (V2).** Wants allowlists, thresholds and an event feed. V1 must not paint us into a corner: policies live in one JSON schema from day one.

## 6. User stories

- US-1: As a user, when I land on a page with a login form on a domain that isn't the brand it imitates, I see a red interstitial before I can type.
- US-2: As a user, on a page that looks a bit off (MEDIUM), I get a non-blocking amber banner with the top reasons, dismissable per-tab.
- US-3: As a user, I can paste a URL into the popup and get a verdict without visiting the page.
- US-4: As a user, I can allowlist a domain I trust and never be warned on it again.
- US-5: As a user, I can see *why* a page was flagged (top 3 contributing signals in plain English).
- US-6: As a user, the extension never slows page loads noticeably and never breaks a site.
- US-7: As a user, I can turn the extension off for a tab or globally in one click.

## 7. Functional requirements

### 7.1 Navigation interception
- FR-1: Subscribe to `webNavigation.onBeforeNavigate`, `onCommitted`, and `onCompleted` for main frames. Sub-frames are scored only when they contain a password field.
- FR-2: Stage 1 (URL-only) verdict computed synchronously on `onBeforeNavigate` from lexical URL features. Badge updated immediately.
- FR-3: Stage 2 (URL + DOM + content) verdict computed by content script at `document_idle` and again on DOM mutations that add a `<form>` or `input[type=password]` (debounced 250 ms, max 3 re-scores per page).
- FR-4: Final verdict = max(stage1, stage2) unless stage 2 has high confidence benign (allows URL false positives to be rescued by clean DOM).

### 7.2 Detection engine
- FR-5: Feature extractor produces a fixed-order `Float32Array` of N features (spec in §10). Same code path in popup (manual check) and content script.
- FR-6: V0 engine = weighted heuristic rules returning score ∈ [0,1] plus a list of fired rules.
- FR-7: V1 engine = gradient-boosted tree ensemble compiled to WebAssembly, returning probability ∈ [0,1] plus per-feature contribution for explainability. Heuristics remain as a hard override layer (e.g. IP-literal host + password field ⇒ HIGH regardless of model).
- FR-8: Thresholds: `LOW < 0.35 ≤ MEDIUM < 0.75 ≤ HIGH`. Thresholds are config values, not constants, tuned on validation data and documented in the model card.
- FR-9: Allowlist check happens before any scoring. Allowlisted eTLD+1 ⇒ LOW, no rules evaluated.
- FR-10: Bundled Tranco top-50k eTLD+1 set (as a Bloom filter, ≤ 200 KB) used as a feature, **not** as an automatic allowlist — lookalike subdomains on legit hosting must still score.

### 7.3 Verdict actions
- FR-11: LOW ⇒ green badge, nothing else.
- FR-12: MEDIUM ⇒ amber badge + top-of-page banner (shadow DOM, non-blocking, dismissable, shows top 3 reasons, "Report as safe" button which adds to allowlist).
- FR-13: HIGH ⇒ red badge + full-page interstitial (shadow DOM overlay, `pointer-events` blocked on page beneath) with "Go back" (primary) and "Proceed anyway" (secondary, requires a second confirm). Password inputs beneath are made `readonly` until proceed.
- FR-14: HIGH in a page loaded before extension init (e.g. after service-worker restart) must still be caught: content script always requests a score on injection.
- FR-15: Form submission on a HIGH page is blocked at the `submit` event (capture phase) unless the user has proceeded.

### 7.4 Popup
- FR-16: Shows current tab verdict, score, reasons, allowlist toggle, global on/off.
- FR-17: Manual check: paste a URL ⇒ stage 1 verdict instantly; optional "Fetch and deep-scan" does a background `fetch()` of the HTML (no cookies, no JS execution), parses with `DOMParser` in an offscreen document, and runs stage 2.

### 7.5 Settings and storage
- FR-18: `chrome.storage.sync` for: allowlist, global enabled flag, threshold overrides (hidden behind an "advanced" toggle).
- FR-19: `chrome.storage.session` for per-tab state (verdict, dismissed banner, proceeded flag) so service-worker restarts don't lose it.
- FR-20: Model file versioned; extractor version and model version are both stamped into every verdict object.

### 7.6 Explainability
- FR-21: Every verdict carries `reasons: Array<{code, humanText, weight}>` sorted by weight. Codes are stable identifiers (e.g. `URL_IP_HOST`, `DOM_PASSWORD_EXTERNAL_ACTION`) for future telemetry.

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Latency | Stage 1 ≤ 50 ms p95. Stage 2 ≤ 400 ms p95 on a page with ≤ 5,000 DOM nodes. Hard timeout at 1,500 ms ⇒ verdict `UNKNOWN`, badge grey, no block. |
| Memory | WASM module ≤ 1 MB. Total bundled assets ≤ 3 MB. |
| Privacy | Zero network requests initiated by the extension except user-triggered manual deep-scan of the pasted URL. Verified by test. |
| Security | No remote code. CSP: `script-src 'self' 'wasm-unsafe-eval'`. Content scripts touch the page only through a closed shadow root. No `innerHTML` with page-derived strings. |
| Robustness | Must never throw an uncaught error into the page. Any extractor failure ⇒ that feature = NaN-safe default, engine continues. |
| Compatibility | Chrome ≥ 120, Edge ≥ 120, Brave current. |
| Accessibility | Banner and interstitial keyboard navigable, ARIA roles, contrast ≥ 4.5:1. |
| Updatability | Model swap requires only replacing `model.bin` + bumping `model_version`. No code change. |

## 9. Architecture and technology decisions

**Decision: TypeScript for the extension, Rust → WebAssembly for the inference engine, Python for training.**

Why this and not the alternatives:

- **TypeScript** is the only realistic choice for MV3 glue (APIs are JS-native, types catch the many nullable Chrome API returns). Build with Vite + `@crxjs/vite-plugin` for HMR and MV3 manifest generation.
- **Rust/WASM for inference** rather than ONNX Runtime Web: ORT-Web is 5–10 MB and has a cold-start cost that is unacceptable inside an MV3 service worker that gets killed after 30 s of idle. A hand-written tree-ensemble evaluator in Rust compiles to < 100 KB, instantiates in < 5 ms, and evaluates 300 trees in tens of microseconds. Feature extraction stays in TypeScript (it needs the DOM anyway); only `predict(features) -> (prob, contributions)` crosses the WASM boundary.
- **Python (scikit-learn / XGBoost / LightGBM)** for training because that's where the ecosystem is. The exported model is a compact custom binary (node arrays), not ONNX.
- **Playwright** for end-to-end tests: it can load unpacked extensions in a persistent Chromium context and exercise real navigations.

```
┌─────────────────────────────── Browser ───────────────────────────────┐
│  Service worker (TS)                                                  │
│   ├─ webNavigation listeners ─► Stage 1: url-features.ts ─► engine   │
│   ├─ tab state (storage.session), allowlist (storage.sync)            │
│   ├─ badge + message bus                                              │
│   └─ engine.ts ─────────────► WASM (Rust): predict(), contributions() │
│                                                                       │
│  Content script (TS, document_idle)                                   │
│   ├─ dom-features.ts, content-features.ts                             │
│   ├─ sends feature vector to SW ─► receives verdict                   │
│   ├─ banner / interstitial (closed shadow DOM)                        │
│   └─ submit interceptor                                               │
│                                                                       │
│  Popup (TS + minimal HTML) ─ manual check, allowlist, on/off          │
│  Offscreen document ─ DOMParser for manual deep-scan                  │
└───────────────────────────────────────────────────────────────────────┘
        ▲ model.bin + tranco.bloom + brands.json (static, versioned)
        │
┌─── Training pipeline (Python, offline) ───┐
│ collect ─► extract (shared feature spec) ─► train ─► calibrate ─► export │
└─────────────────────────────────────────┘
```

**Critical invariant:** feature extraction logic exists once, in TypeScript, and the Python pipeline calls it via Node for dataset generation. Two implementations of the same feature drift within a week.

## 10. Feature specification (V1)

Fixed order. Version this file; the model is only valid for a matching extractor version.

### 10.1 URL lexical (stage 1 and 2)
| # | Name | Type | Notes |
|---|---|---|---|
| 0 | `url_len` | int | full URL length |
| 1 | `host_len` | int | |
| 2 | `path_len` | int | |
| 3 | `query_len` | int | |
| 4 | `num_dots_host` | int | |
| 5 | `num_subdomains` | int | labels left of eTLD+1 (use `tldts`) |
| 6 | `num_hyphens_host` | int | |
| 7 | `num_digits_host` | int | |
| 8 | `host_is_ip` | bool | v4 or v6 literal |
| 9 | `has_at_symbol` | bool | |
| 10 | `has_double_slash_in_path` | bool | |
| 11 | `num_query_params` | int | |
| 12 | `has_punycode` | bool | `xn--` label present |
| 13 | `host_entropy` | float | Shannon, base 2 |
| 14 | `tld_risk` | float | lookup table: 0 for com/org/nz/…, weighted for known-abused TLDs |
| 15 | `num_special_chars` | int | `%`, `~`, `=`, `&` etc. in path+query |
| 16 | `is_https` | bool | |
| 17 | `nonstandard_port` | bool | |
| 18 | `brand_in_subdomain` | bool | any of ~250 brand tokens in a non-eTLD+1 label |
| 19 | `brand_in_path` | bool | |
| 20 | `brand_lookalike_host` | float | min Damerau-Levenshtein distance (normalised) from eTLD+1 to brand list; 0 when exact match |
| 21 | `is_url_shortener` | bool | bit.ly, t.co, tinyurl… |
| 22 | `phish_keyword_count` | int | login, verify, secure, account, update, confirm, wallet, invoice, suspended… |
| 23 | `in_tranco_50k` | bool | Bloom filter on eTLD+1 |
| 24 | `path_depth` | int | |
| 25 | `has_file_ext_html_php` | bool | |
| 26 | `hex_ratio_path` | float | proportion of hex-looking segments |

### 10.2 DOM structure (stage 2 only; default 0/false for stage 1)
| # | Name | Notes |
|---|---|---|
| 27 | `num_forms` | |
| 28 | `has_password_input` | includes `autocomplete=current-password` |
| 29 | `password_form_action_external` | form action eTLD+1 ≠ page eTLD+1 |
| 30 | `password_form_action_empty_or_js` | `""`, `#`, `javascript:` |
| 31 | `num_external_scripts` | src eTLD+1 ≠ page |
| 32 | `external_script_ratio` | |
| 33 | `num_iframes` | |
| 34 | `num_hidden_inputs` | |
| 35 | `num_anchors` | |
| 36 | `external_anchor_ratio` | |
| 37 | `anchor_null_ratio` | `href="#"` / `javascript:void` |
| 38 | `favicon_external` | |
| 39 | `has_meta_refresh` | |
| 40 | `title_brand_mismatch` | brand token in `<title>` not matching eTLD+1 |
| 41 | `copyright_brand_mismatch` | brand token in footer/© text not matching eTLD+1 |
| 42 | `login_form_on_http` | |
| 43 | `dom_node_count` | capped at 20,000 |
| 44 | `form_added_after_load` | set by mutation observer |
| 45 | `password_field_in_iframe` | |
| 46 | `num_onsubmit_handlers` | inline attribute count |

### 10.3 Content semantics (stage 2 only)
| # | Name | Notes |
|---|---|---|
| 47 | `urgency_term_count` | "verify now", "suspended", "within 24 hours", "unusual activity"… |
| 48 | `credential_term_count` | "password", "PIN", "one-time code", "security question"… |
| 49 | `financial_term_count` | "bank", "card", "payment", "invoice", "refund"… |
| 50 | `visible_text_len` | capped |
| 51 | `text_to_html_ratio` | |
| 52 | `lang_mismatch_tld` | page `lang` vs ccTLD (weak signal, keep) |

53 features. Stage 1 uses 0–26 with the rest zeroed; the model is trained with stage-1-shaped rows included so it handles both.

### 10.4 Hard-override heuristics (applied after the model)
- `host_is_ip && has_password_input` ⇒ HIGH
- `password_form_action_external && !in_tranco_50k(action host)` ⇒ at least MEDIUM
- `brand_lookalike_host < 0.15 && brand_lookalike_host > 0 && has_password_input` ⇒ HIGH
- `has_punycode && brand_in_subdomain` ⇒ HIGH
- Allowlisted ⇒ LOW (evaluated first, short-circuits everything)

## 11. UX specification

**Badge:** toolbar icon tinted green/amber/red/grey (unknown). Text badge shows nothing for LOW; "!" for MEDIUM/HIGH.

**Banner (MEDIUM):** 48 px strip, top of viewport, fixed, z-index max, closed shadow root. Copy pattern: *"This page looks like a login for **Xero** but the site is `xero-secure-login.com`."* Then up to three reason chips. Buttons: Dismiss · This site is safe. Never auto-hides.

**Interstitial (HIGH):** full-viewport overlay, dark background, single card. Headline: *"Stop — this page is probably phishing."* Body: the single strongest reason in one sentence, then two more reasons as bullets. Primary button "Go back" (calls `history.back()` or closes tab if no history). Secondary link "I understand the risk, continue" ⇒ second confirm ("Passwords typed here may be stolen. Continue?"). After proceed: overlay removed, red badge stays, banner shows "You chose to proceed."

**Popup:** verdict card (colour, score as percentage, reasons), allowlist toggle for current eTLD+1, global enable switch, "Check a link" input with two buttons: Quick check (URL only) and Deep scan (fetch + parse).

**Copy rules:** name the brand and the actual domain in every warning; never say "may be unsafe" without a reason; no jargon (no "entropy", "eTLD").

## 12. Data and model plan

- **Sources:** PhishTank (verified-online feed), OpenPhish (community feed), Tranco top-1M (benign), plus a curated benign set of ~2,000 real login pages from top SaaS/banks/universities crawled by us (this is the set that kills false positives — most public benign sets contain no login forms).
- **Collection:** headless crawl with Playwright, 10 s timeout, store raw HTML + final URL + screenshot (for later V3) + timestamp. Phishing pages die fast; crawl within hours of feed publication.
- **Split:** temporal, not random. Train on everything before date T, validate on T→T+14d, test on T+14d→T+28d. This is what makes the "zero-day" number honest.
- **Model:** LightGBM, ≤ 300 trees, max depth 6, `num_leaves ≤ 48`, monotone constraints where obvious (e.g. `host_is_ip` non-decreasing). Class weights to push recall. Platt or isotonic calibration on validation set so the probability is meaningful and thresholds transfer.
- **Export:** custom binary — per tree: `feature_idx: u8[]`, `threshold: f32[]`, `left: u16[]`, `right: u16[]`, `leaf_value: f32[]`, plus `base_score`, `feature_count`, `extractor_version`, `model_version`, SHA-256 in header.
- **Model card** committed with every export: dataset dates, sizes, metrics per split, threshold rationale, known failure modes.

## 13. Release plan

**V0 — Heuristic MVP (weeks 1–4)**
Extension shell, stage 1 + stage 2 feature extraction, weighted-rule engine, badge/banner/interstitial, popup with quick check, allowlist, Playwright e2e suite, zero-network test. Ship to 10 internal testers.

**V1 — ML extension (weeks 5–10)**
Data pipeline, LightGBM training + calibration + export, Rust/WASM evaluator, per-feature contributions for reasons, deep-scan via offscreen document, performance budget enforcement in CI, security self-review, Web Store listing (unlisted). Ship to ~100 users.

## 14. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| False positives on legit login pages (SSO, white-label banking on vendor domains) | Users uninstall | Curated benign login crawl; allowlist one click away; MEDIUM never blocks |
| MV3 service worker killed mid-score | Missed verdict | Content script re-requests on inject; state in `storage.session`; WASM init ≤ 5 ms so cold start is cheap |
| Page CSS/JS interferes with overlay | Warning hidden or broken | Closed shadow root, `all: initial`, inline styles, z-index 2147483647, re-assert on mutation |
| Feature drift between TS extractor and training data | Silent accuracy collapse | Single extractor, golden-file tests, extractor version stamped in model header and checked at load |
| Phishing kits on legit hosting (Cloudflare Pages, Vercel, Google Sites) | Model trusts Tranco domain | `in_tranco_50k` is a feature not an allowlist; brand-mismatch DOM features carry weight |
| Web Store review rejects `<all_urls>` | Can't ship | Justification text prepared; `activeTab` fallback mode documented |

## 15. Open questions

1. Do we bundle Tranco as a Bloom filter (small, false positives) or a sorted hash table (exact, ~1.5 MB)? Default: Bloom at 1% FP.
2. Brand list — hand-curated ~250, or derived from Tranco top-500 + NZ/AU banks? Default: both, deduped.
3. Should MEDIUM ever block on password focus (soft block)? Default: no in V1; measure banner engagement first.
4. Sub-frame login forms (embedded SSO iframes are common and legitimate) — score in V1 or defer? Default: score but cap at MEDIUM.

---
*Next document: `AGENT-CHECKLIST-v1.md` — the step-by-step build plan for an autonomous coding agent.*
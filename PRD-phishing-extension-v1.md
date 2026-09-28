# Product Requirements Document — Sentinel, Real-Time On-Device Phishing Detection (V0 → V1)

**Codename:** Sentinel
**Owner:** Shawn Mathew
**Status:** V0 (heuristic MVP) **shipped** as `v0.1.0` (tag `v0.1.0`); V1 (ML/WASM) in progress.
**Extractor version:** 1 · **Model:** none bundled yet (`model.bin` is an inert placeholder) · **Engine:** heuristic.
**Last updated:** 2026-09-28

**Scope:** Everything up to and including V1 (client-only ML extension). V2 (hybrid backend, enterprise console) and V3 (multi-modal) are explicitly out of scope.

---

## 0. Current status (what actually exists)

Sentinel is a working Chrome (MV3) extension that scores every navigation for
credential-phishing risk **entirely on-device** and warns before a password is
submitted. Detection today is a **hand-tuned weighted-rule engine** (`packages/heuristics`)
over a fixed **53-feature vector** extracted by `packages/features`. The V1 upgrade —
a LightGBM model compiled to Rust/WASM — is planned but not implemented.

| Area | State |
|---|---|
| Extension shell (MV3) | Done |
| Feature extraction (53 features, stage 1 + 2) | Done |
| Heuristic engine (32 rules, noisy-OR, hard overrides) | Done |
| Banner / interstitial / popup UX | Done |
| Tranco top-50k Bloom filter (feature #23) | Done, wired |
| Data collector (OpenPhish + curated benign) + Playwright crawler | Done |
| Detection evaluation harness + CI gate | Done (fixture corpus baseline) |
| Trained model + WASM inference | Not implemented |
| Deep scan (offscreen `DOMParser`) | Not implemented (stub) |
| Real-data temporal evaluation | In progress (collection started 2026-09-28; needs ~6 weeks) |

---

## 1. Problem

Phishing still works because the warning arrives too late or not at all. Browser
safe-browsing lists lag zero-day pages by hours to days, corporate email filters miss
anything delivered over chat/SMS/QR, and users have been trained to click through
vague warnings.

The gap: **nothing sits at the exact moment a user is about to type a password into a
page and asks "is this page what it claims to be?"** — using the page itself as
evidence, locally, in under a second.

## 2. Vision

A Chrome (MV3) extension that intercepts every navigation, extracts URL + DOM + content
signals on-device, scores them, and surfaces a LOW / MEDIUM / HIGH verdict before a
credential is submitted. No URL or page content ever leaves the browser in V1.

## 3. Goals and success metrics

| Goal | Metric | Target | Status |
|---|---|---|---|
| Catch phishing before submit | Recall on held-out phishing set | ≥ 95% | not measured (temporal eval pending) |
| Don't annoy users | False positive rate on Tranco top-10k benign | ≤ 2% | not measured |
| Zero-day coverage | Recall on phishing URLs first seen ≥ 14 days after training cutoff | ≥ 90% | not measured |
| Feel instant | URL-stage verdict p95 (navigation → badge) | ≤ 50 ms | **met** — 2.5 ms p95 (e2e) |
| Feel instant | Full verdict p95 (DOM ready → banner) | ≤ 400 ms | **met** — 9.8 ms p95 (e2e) |
| Stay light | Extension steady-state memory (service worker + one content script) | ≤ 60 MB | not measured |
| Stay private | Bytes sent off-device by the extension | 0 | **met** — `no-network.spec.ts` |
| Users heed HIGH | Click-through rate on HIGH interstitial in usability tests | ≤ 15% | pending (`docs/USABILITY.md`) |

## 4. Non-goals (V1)

- No backend, no accounts, no telemetry uploads, no threat-intel API calls at runtime.
- No screenshot / visual similarity models.
- No Firefox / Safari builds (Chromium-family only: Chrome, Edge, Brave).
- No enterprise policy distribution or admin console (the `Settings` JSON schema is
  kept tenant-ready).
- No email-client integration; "check a link" is a manual paste box only.
- No attempt to detect malware, drive-by downloads, or scam content that isn't
  credential/payment phishing.

## 5. Personas

**P1 — Individual power user (primary for V1).** Security-aware, installs from the Web
Store, wants a second opinion on links from chat and email. Tolerates zero false
positives on the sites they use daily.

**P2 — Small business staff (target for V2, design for now).** Non-technical, uses
Xero/Gmail/Microsoft 365/bank portals daily. Needs blocking to be the default on HIGH
and a plain-English reason.

**P3 — IT admin at an SME (V2).** Wants allowlists, thresholds and an event feed. V1
must not paint us into a corner: policies live in one JSON schema from day one.

## 6. User stories

- US-1: When I land on a page with a login form on a domain that isn't the brand it
  imitates, I see a red interstitial before I can type. *(implemented)*
- US-2: On a page that looks a bit off (MEDIUM), I get a non-blocking amber banner with
  the top reasons, dismissable per-tab. *(implemented)*
- US-3: I can paste a URL into the popup and get a verdict without visiting the page.
  *(implemented — stage-1 "Quick check"; "Deep scan" not yet)*
- US-4: I can allowlist a domain I trust and never be warned on it again. *(implemented)*
- US-5: I can see *why* a page was flagged (top contributing signals in plain English).
  *(implemented)*
- US-6: The extension never slows page loads noticeably and never breaks a site.
  *(implemented; content-script size hardening is a V1 task)*
- US-7: I can turn the extension off for a tab or globally in one click. *(implemented —
  global toggle; per-tab is allowlist/dismiss)*

## 7. Functional requirements

### 7.1 Navigation interception — implemented
- FR-1: Subscribe to `webNavigation.onBeforeNavigate`, `onCommitted`, and `onCompleted`
  for main frames. Sub-frames are scored only when they contain a password field.
- FR-2: Stage 1 (URL-only) verdict computed on `onBeforeNavigate` from lexical URL
  features. Badge updated immediately. *(awaits the settings + Bloom readiness barrier)*
- FR-3: Stage 2 (URL + DOM + content) computed by the content script at `document_idle`
  and again on DOM mutations that add a `<form>` or `input[type=password]` (debounced
  250 ms, max 3 re-scores per page, sets `form_added_after_load`).
- FR-4: Final verdict = max(stage1, stage2) with two exceptions: a stage-1 HIGH is never
  downgraded, and a confident-clean stage 2 (score < 0.15) rescues a stage-1 MEDIUM.

### 7.2 Detection engine — implemented (heuristic); V1 model pending
- FR-5: Feature extractor produces a fixed-order `Float32Array` of **53** features
  (spec in §10). One code path shared by the popup (manual check), the content script,
  and the Python pipeline (via the Node bridge).
- FR-6: V0 engine = **32 weighted heuristic rules** returning score ∈ [0,1] via
  **noisy-OR** (`1 − Π(1 − wᵢ)`) plus the list of fired rules. *(shipped)*
- FR-7: V1 engine = gradient-boosted tree ensemble compiled to WebAssembly, returning
  probability ∈ [0,1] plus per-feature contribution. Heuristics remain as the hard
  override layer. *(not implemented; `packages/engine-wasm` is a stub)*
- FR-8: Thresholds: `LOW < 0.35 ≤ MEDIUM < 0.75 ≤ HIGH` (`DEFAULT_THRESHOLDS`), stored in
  `Settings.thresholds`, tunable per user.
- FR-9: Allowlist check happens before scoring. Allowlisted eTLD+1 ⇒ LOW, no rules
  evaluated.
- FR-10: Bundled Tranco top-50k eTLD+1 set as a **Bloom filter** (custom "TBLM" binary,
  FNV-1a double hashing, 58.5 KiB) used as a feature, **not** an auto-allowlist.

### 7.3 Verdict actions — implemented
- FR-11: LOW ⇒ green badge, nothing else.
- FR-12: MEDIUM ⇒ amber badge + top-of-page banner (closed shadow DOM, dismissable,
  top reasons, "This site is safe" → allowlist).
- FR-13: HIGH ⇒ red badge + full-page interstitial (page `inert`, password fields
  `readonly`, two-step confirm). "Go back" (primary) / "Continue anyway" (secondary).
- FR-14: HIGH on a page loaded before extension init is still caught — the content
  script always requests a score on injection.
- FR-15: Form submission on a HIGH page is blocked in the capture phase unless the user
  has proceeded; credential *typing* is also prevented (`keydown`/`paste`/`beforeinput`).

### 7.4 Popup — implemented
- FR-16: Verdict card (level, score %, reasons), allowlist toggle, global on/off.
- FR-17: Manual check: paste a URL ⇒ stage-1 verdict instantly. Deep-scan
  (fetch + offscreen `DOMParser`) is a **stub** returning `UNKNOWN`.

### 7.5 Settings and storage — implemented
- FR-18: `chrome.storage.sync` for allowlist, enabled flag, thresholds (zod-validated,
  self-healing). Cached in memory for the hot path.
- FR-19: `chrome.storage.session` for per-tab state so service-worker restarts don't
  lose it.
- FR-20: Extractor version and model version are stamped into every verdict object
  (`modelVersion` is `null` until V1).

### 7.6 Explainability — implemented
- FR-21: Every verdict carries `reasons: Array<{code, humanText, weight}>` sorted by
  weight. `copy.ts` maps every rule code to jargon-free plain English.

## 8. Non-functional requirements

| Area | Requirement | Status |
|---|---|---|
| Latency | Stage 1 ≤ 50 ms p95. Stage 2 ≤ 400 ms p95 (≤ 5,000 nodes). Hard timeout 1,500 ms ⇒ stage 1 or `UNKNOWN`, badge grey. | **met** (2.5 / 9.8 ms p95 in e2e) |
| Memory | WASM module ≤ 1 MB. Total bundled assets ≤ 3 MB. | enforced by `size-limit` |
| Privacy | Zero network requests initiated by the extension except user-triggered deep scan. | **met** — `no-network.spec.ts` |
| Security | No remote code. CSP `script-src 'self' 'wasm-unsafe-eval'`. Closed shadow root. No `innerHTML` with page strings. | implemented |
| Robustness | Never throw into the page. Extractor failure ⇒ feature defaulted, warning recorded. | implemented |
| Compatibility | Chrome ≥ 120, Edge ≥ 120, Brave current. | implemented |
| Accessibility | Banner/interstitial keyboard-navigable, ARIA roles, contrast ≥ 4.5:1. | axe: zero violations |
| Updatability | Model swap requires only replacing `model.bin` + bumping `model_version`. | pending V1 |

## 9. Architecture and technology decisions

**Decision: TypeScript for the extension, Rust → WebAssembly for inference, Python for
training.** (recorded as `docs/DECISIONS.md` #1)

- **TypeScript** for MV3 glue (Vite + `@crxjs/vite-plugin`, manifest generation, HMR).
- **Rust/WASM** for inference, *not* ONNX Runtime Web: ORT-Web is 5–10 MB with an
  unacceptable MV3 cold start; a hand-written tree evaluator compiles to < 150 KB and
  evaluates in tens of microseconds. **Not implemented yet** — `packages/engine-wasm` is
  a stub (`version()`/`add()`), `model.bin` is an inert placeholder.
- **Python (LightGBM)** for offline training; export is a compact custom binary, not ONNX.
- **Playwright** for e2e (loads the unpacked extension in a persistent Chromium context).

### Current stack

| Layer | Choice | Notes |
|---|---|---|
| Extension | TypeScript 5.9 (strict) | `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| Bundler | Vite 8 + `@crxjs/vite-plugin` 2.7 | MV3 manifest generation |
| Lint / format / test | ESLint 10 (typescript-eslint strict) / Prettier / Vitest 5 | coverage gates ≥ 85% |
| Inference (future) | Rust 1.96 → `wasm32` (`wasm-bindgen`) | stub |
| Training | Python 3.13 via `uv` | LightGBM 4.7, scikit-learn, pandas, numpy, pyarrow, tldextract, playwright, pydantic, pyyaml |
| E2E | Playwright (Chromium) | 43 tests, e2e build mode |
| Package manager | pnpm workspaces | `apps/*`, `packages/*`, `tests/*` |
| Target | Chrome ≥ 120 | Chromium family |

### Runtime architecture (as built)

```
┌─────────────────────────── Browser ───────────────────────────┐
│ Service worker (TS, background/)                              │
│  ├─ webNavigation.onBeforeNavigate/onCommitted/onCompleted    │
│  ├─ stage-1 scoring: extractStage1 → engine → badge/state     │
│  ├─ tab state (storage.session), settings (storage.sync)      │
│  ├─ settings cache + Tranco bloom cache (readiness barrier)   │
│  └─ engine.ts → heuristicEngine (WASM engine in V1)           │
│                                                               │
│ Content script (TS, content/, document_idle, all_frames)      │
│  ├─ stage-2 extraction (53 features) → SCORE_REQUEST          │
│  ├─ closed-shadow-DOM banner / interstitial                   │
│  ├─ submit guard + tamper guard + trusted input               │
│  └─ renders SCORE_RESULT                                      │
│                                                               │
│ Popup (TS + HTML, no framework) — verdict card, allowlist,    │
│  on/off, "Check a link" (stage-1 MANUAL_CHECK)                │
└───────────────────────────────────────────────────────────────┘
        ▲ tranco.bloom + brands.json (bundled, versioned)
        │
┌─── Offline pipeline (Python, uv) ───┐
│ collect → crawl → filter → eval → freeze → (train, V1)        │
└────────────────────────────────────┘
```

**Critical invariant:** feature extraction exists **once**, in TypeScript
(`packages/features`). The Python pipeline calls it via the Node bridges
(`pnpm extract`, `pnpm score`), so training, evaluation and the browser all score
identical vectors.

### Repository layout

```
apps/extension/        MV3 extension (background, content, popup, shared, test/)
packages/features/     Feature extraction (shared browser/Node)
packages/heuristics/   V0 scoring/verdict engine
packages/engine-wasm/  Rust crate (stub)
pipeline/              Python: collect/, crawl/, eval/, settings.py, storage.py,
                       run_collection.py, run_eval.py, build_bloom.py, freeze_dataset.py,
                       config.yaml
tests/e2e/             Playwright harness + specs
fixtures/              benign/phish/edge pages, 25-page verdict corpus, golden DOM, bloom
docs/                  DECISIONS, AUDIT, OPEN-QUESTIONS, LATENCY, EVAL, DATASET,
                       COLLECTION, USABILITY, INSTALL-TESTERS
scripts/               score.ts, corpus-expected.ts, pack-zip.mjs, generate-icons.mjs
```

## 10. Feature specification (V1)

Fixed order, 53 features (`FEATURE_COUNT = 53`, `EXTRACTOR_VERSION = 1`). The model is
only valid for a matching extractor version; bumping the extractor requires regenerating
the golden fixtures and retraining.

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
| 18 | `brand_in_subdomain` | bool | any of ~280 brand tokens in a non-eTLD+1 label |
| 19 | `brand_in_path` | bool | |
| 20 | `brand_lookalike_host` | float | min normalised Damerau-Levenshtein from eTLD+1 SLD to brand list, after homoglyph folding; 0 when exact/legit |
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
| 50 | `visible_text_len` | capped at 50,000 |
| 51 | `text_to_html_ratio` | |
| 52 | `lang_mismatch_tld` | page `lang` vs ccTLD (weak signal) |

53 features. Stage 1 uses 0–26 with the rest zeroed; the model will be trained with
stage-1-shaped rows included so it handles both.

### 10.4 Hard-override heuristics (applied after the model/heuristic)
- `host_is_ip && has_password_input` ⇒ HIGH
- `password_form_action_external && !in_tranco_50k(action host)` ⇒ at least MEDIUM
  *(implementation note: current code forces MEDIUM for any external action without
  checking the action host's Tranco membership — see `docs/AUDIT-2026-09.md` 0.1)*
- `brand_lookalike_host < 0.15 && brand_lookalike_host > 0 && has_password_input` ⇒ HIGH
- `has_punycode && brand_in_subdomain` ⇒ HIGH
- Allowlisted ⇒ LOW (evaluated first, short-circuits everything)

## 11. UX specification

**Badge:** toolbar icon tinted green/amber/red/grey (unknown); "!" text for MEDIUM/HIGH.
*(4 pre-rendered icon sets at 16/32/48/128.)*

**Banner (MEDIUM):** fixed top strip, max z-index, closed shadow root. Copy pattern:
*"This page looks like a login for **Xero** but the site is `xero-secure-login.com`."*
then up to three reason chips. Buttons: Dismiss · This site is safe. Dismiss persists per
tab; actions require trusted (`isTrusted`) input.

**Interstitial (HIGH):** full-viewport overlay, single card. Headline: *"Stop — this page
is probably phishing."* Body: strongest reason, then two more as bullets. Primary "Go
back" (`history.back()` or close tab); secondary "I understand the risk, continue" ⇒
second confirm. While HIGH and un-proceeded the page is `inert`, password fields are
`readonly`, and a tamper guard re-asserts the block if the page strips it.

**Popup:** verdict card (colour, score %, reasons), allowlist toggle, global enable
switch, "Check a link" (Quick check, stage-1). Deep scan is pending V1.

**Copy rules:** name the brand and the actual domain in every warning; never say "may be
unsafe" without a reason; no jargon (no "entropy", "eTLD").

**Security model (the defender assumes the page is hostile):** closed shadow root
(reached in tests only via an isolated-world bridge absent from production); trusted
input only; tamper re-assertion; non-form credential-exfiltration guards
(`keydown`/`paste`/`beforeinput`); no `innerHTML` with page strings.

## 12. Data and model plan

**Implemented (offline, `pipeline/`):**
- **Collect** — OpenPhish community feed (key-free, ~300 URLs/day) with `first_seen`
  assigned on first sighting; a curated benign login set (`collect/curated_benign.txt`,
  109 verified-reachable real logins: NZ/AU banks, Xero/MYOB/RealMe/IRD, universities,
  SSO white-label domains). Idempotent, append-only parquet store.
- **Crawl** — async Playwright (concurrency 16, 10 s timeout, media/fonts/stylesheets
  blocked, ≤ 2 MB, one retry), content-addressed HTML; **filter** drops non-200,
  < 500 B, parked/for-sale, and redirect-to-legit pages.
- **Eval** — JSONL dataset schema (`{url, html, label, source, first_seen}`); metrics
  (precision, recall, F1, ROC-AUC, PR-AUC, FPR@recall 0.95, confusion, threshold sweep);
  report → `docs/EVAL.md` + `results.json`; CI gate (`eval_gate.py`).
- **Freeze** — SHA-256 manifest of every artifact → `docs/DATASET.md`.

**Planned (V1, gated on ~6 weeks of collection):**
- **Split** — temporal, not random: train < T, validate [T, T+14d), test [T+14d, T+28d),
  so the zero-day number is honest.
- **Model** — LightGBM, ≤ 300 trees, max depth 6, `num_leaves ≤ 48`, monotone
  constraints, class weights to push recall, isotonic calibration on validation.
- **Export** — custom binary: per tree `feature_idx: u8[]`, `threshold: f32[]`,
  `left: u16[]`, `right: u16[]`, `leaf_value: f32[]`, plus `base_score`, `feature_count`,
  `extractor_version`, `model_version`, SHA-256 in header.
- **Model card** committed with every export.

**Known simplification:** the curated benign set is 109 entries (not the ~2,000 the
original plan targeted); PhishTank requires an API key and is not yet used.

## 13. Release plan

**V0 — Heuristic MVP — DONE (`v0.1.0`).**
Extension shell, stage 1 + stage 2 extraction, weighted-rule engine, badge/banner/
interstitial, popup with quick check, allowlist, Playwright e2e suite, zero-network
test, security hardening (closed shadow root, trusted input, tamper guard, non-form
exfil). Installable zip: `artifacts/sentinel-0.1.0.zip`.

**V1 — ML extension — in progress.**
Data pipeline (done), LightGBM training + calibration + export, Rust/WASM evaluator,
per-feature contributions, deep-scan via offscreen document, real-data temporal
evaluation, performance budget enforcement, security self-review, Web Store listing
(unlisted).

## 14. Risks

| Risk | Impact | Mitigation | Status |
|---|---|---|---|
| False positives on legit login pages (SSO, white-label banking) | Users uninstall | Curated benign crawl; allowlist one click away; MEDIUM never blocks | curated set built |
| MV3 service worker killed mid-score | Missed verdict | Content script re-requests on inject; state in `storage.session` | implemented |
| Page CSS/JS interferes with overlay | Warning hidden or broken | Closed shadow root, inline styles, max z-index, re-assert on mutation | implemented |
| Feature drift between TS extractor and training data | Silent accuracy collapse | Single extractor, golden-file tests, extractor version in model header | implemented (extractor) |
| Phishing kits on legit hosting (Cloudflare Pages, Vercel, Google Sites) | Model trusts Tranco domain | `in_tranco_50k` is a feature, not an allowlist; brand-mismatch features carry weight | feature wired |
| Web Store review rejects `<all_urls>` | Can't ship | Justification text prepared; `activeTab` fallback documented | pending |

## 15. Open questions

1. ~~Bloom vs sorted hash table for Tranco~~ — resolved: Bloom at ~1% FP (58.5 KiB).
2. ~~Brand list hand-curated vs derived~~ — resolved: hand-curated (~280 tokens) + NZ/AU.
3. ~~Should MEDIUM ever soft-block on password focus?~~ — resolved: no in V1.
4. ~~Sub-frame login forms score in V1?~~ — resolved: score sub-frames that contain a
   password field.
5. **PhishTank API key** — OpenPhish-only volume is thin; a key would improve the
   temporal test set and zero-day metric.
6. **Temporal split cadence** — the collector must run every 6 h for ~6 weeks before the
   model can be trained (see `docs/COLLECTION.md`).
7. **Content-script size** — the bundle currently exceeds the 60 KB gz target;
   tree-shaking (`tldts`, lazy brand tables) is a V1 cleanup.

---

*Living documents: `README.md` (code tour), `docs/DECISIONS.md` (ADRs),
`docs/EVAL.md` (metrics), `docs/DATASET.md` (dataset manifest),
`docs/LATENCY.md` (benchmarks), `docs/USABILITY.md` (usability protocol).*

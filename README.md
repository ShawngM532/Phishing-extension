# Sentinel — On-Device Phishing Detection Extension

Sentinel is a Chrome (Manifest V3) browser extension that scores every page you
navigate to for phishing risk **entirely on-device** — no network calls, no
telemetry — and warns you before you type a password into a page that isn't
what it claims to be.

This README is a deep, code-level tour of the repository: what each part
does, how the pieces talk to each other, and where to find the function that
implements a given behavior. For the product spec (requirements, UX copy
rules, full feature table) see [`PRD-phishing-extension-v1.md`](PRD-phishing-extension-v1.md).
For "why did we build it this way" see [`docs/DECISIONS.md`](docs/DECISIONS.md).

**Current status:** v0.1.0 — **V0, the heuristic MVP**. Detection today is a
hand-tuned, weighted-rule scoring engine written in TypeScript. A V1 upgrade
(a LightGBM model compiled to Rust/WASM) is planned but not yet implemented —
see [Current status & known gaps](#current-status--known-gaps).

---

## Table of contents

1. [Repository layout](#repository-layout)
2. [Architecture](#architecture)
3. [Detection pipeline deep-dive](#detection-pipeline-deep-dive)
4. [Function / module reference](#function--module-reference)
5. [Data flow walkthrough](#data-flow-walkthrough-a-real-navigation)
6. [Manifest & permissions](#manifest--permissions)
7. [Build, test, and tooling](#build-test-and-tooling)
8. [Current status & known gaps](#current-status--known-gaps)
9. [Where to look next](#where-to-look-next)

---

## Repository layout

This is a **pnpm workspace** (`apps/*`, `packages/*`, `tests/*`) that also
contains a Cargo workspace (Rust/WASM) and a `uv`-managed Python project
(offline pipeline).

```
apps/extension/        The actual browser extension (MV3). See below.
packages/heuristics/    The V0 scoring/verdict engine (TypeScript).
packages/features/      Feature extraction shared by the extension and the
                         Python training pipeline.
packages/engine-wasm/   Rust crate compiled to WASM — the future ML inference
                         engine. Currently just a stub (version()/add()).
pipeline/                Python (uv-managed) offline data/training pipeline:
                         collect -> extract -> train -> calibrate -> export.
                         Only build_bloom.py is implemented; the rest are
                         empty __init__.py scaffolds.
tests/e2e/               Playwright end-to-end suite that drives a real,
                         unpacked build of the extension in Chromium.
fixtures/                Test data: benign/phish page fixtures, a 25-page
                         verdict "corpus" with expected verdicts, golden DOM
                         feature snapshots, and the Tranco Bloom fixture.
docs/                    DECISIONS.md (ADR log), LATENCY.md (benchmark log),
                         INSTALL-TESTERS.md (build/install guide).
scripts/                 pack-zip.mjs (zips dist/ into artifacts/),
                         generate-icons.mjs, corpus-expected.ts.
artifacts/               Built release zips (sentinel-<version>.zip).
store/                   Placeholder for future Web Store listing assets.
PRD-phishing-extension-v1.md   The master product/technical spec.
CHANGELOG.md             Release notes (currently v0.1.0).
```

### `apps/extension/` in detail

```
manifest.config.ts   MV3 manifest, built with @crxjs/vite-plugin's defineManifest
vite.config.ts        Vite + crxjs bundler config
src/background/       Service worker: navigation hooks, scoring, badge, settings, tab state
src/content/           Content script: DOM extraction, shadow-DOM UI, submit guard
src/popup/             Popup UI (verdict card, toggles, manual "check a link")
src/shared/            Types + typed message bus shared by all three contexts
public/icons/, public/model.bin   Static assets (model.bin is an inert placeholder for V1)
test/                  Vitest unit tests + chrome-mock.ts (mocks the chrome.* API)
```

---

## Architecture

Sentinel runs in three isolated JavaScript contexts that only talk to each
other through `chrome.runtime.sendMessage` / `onMessage`, using a fully typed
message contract (`apps/extension/src/shared/messages.ts`):

```
 ┌────────────────────┐        chrome.webNavigation events
 │   Service Worker    │◄───────────────────────────────────
 │ (background/*)      │
 │                      │   chrome.storage.sync   (Settings: enabled,
 │  - stage1 scoring    │◄──────────────────────►  allowlist, thresholds)
 │  - stage merge       │
 │  - badge             │   chrome.storage.session (TabState: per-tab
 │  - message hub       │◄──────────────────────►  stage1/stage2/final verdict)
 └─────────┬────────────┘
           │ chrome.runtime.sendMessage / onMessage (typed Message union)
 ┌─────────▼────────────┐                          ┌──────────────────────┐
 │   Content script      │                          │   Popup               │
 │ (content/*)           │                          │ (popup/main.ts)       │
 │  - stage2 extraction  │                          │  - verdict card       │
 │  - shadow-DOM banner/ │                          │  - enable/allowlist   │
 │    interstitial       │                          │    toggles            │
 │  - submit guard       │                          │  - manual link check  │
 └───────────────────────┘                          └───────────────────────┘
```

- **Service worker** (`background/service-worker.ts`) is the only
  `chrome.webNavigation` / `chrome.runtime.onMessage` listener — it is the hub
  for all state and scoring decisions.
- **Content script** (`content/content-script.ts`) is injected into
  **every frame** (`all_frames: true`) at `document_idle`. It only actually
  runs DOM extraction in sub-frames if they contain a password field
  (catching login iframes without wasting cycles on ad/tracker iframes). The
  warning UI lives in a **closed** shadow root (`ui/host.ts`), so page script
  cannot reach it. E2E builds (`vite build --mode e2e`) additionally install a
  test-only bridge (`content/e2e-bridge.ts`) — an isolated-world
  `chrome.runtime.onMessage` listener reached via `chrome.tabs.sendMessage` —
  which the Playwright suite uses to query and drive the closed UI. It is
  absent from production builds (asserted by a grep in CI). See
  [Decision #6](docs/DECISIONS.md).
- **Popup** is purely a read/write client of the service worker's state — it
  holds no scoring logic itself.
- **Settings** (`Settings`: `enabled`, `allowlist`, `thresholds`) live in
  `chrome.storage.sync` so they roam with the user's Chrome profile, validated
  with `zod`. A **settings cache** (`background/settings-cache.ts`) keeps a
  synchronous, subscribed copy in memory so the hot path
  (`onBeforeNavigate`) never has to `await` storage.
- **Tab state** (`TabState`: `stage1`/`stage2`/`final` verdicts, `proceeded`,
  `dismissed`, timings) lives in `chrome.storage.session`, keyed per tab, so a
  service-worker restart (MV3 workers are ephemeral) doesn't lose in-flight
  state.

---

## Detection pipeline deep-dive

This is the part worth understanding in the most detail — it's split across
two packages so the same logic can run inside the extension **and** be
reused by the offline Python training pipeline.

### 1. Feature extraction — `packages/features`

Every URL/page is turned into a fixed-order **53-slot `Float32Array`**
(`FEATURE_NAMES` / `FEATURE_INDEX` in `src/version.ts`, `EXTRACTOR_VERSION = 1`).
The vector is built in two stages:

- **Stage 1 (indices 0–26, URL-only)** — computed synchronously at
  navigation time, before any page content is available. Includes lexical
  features (`url/lexical.ts`: length, dot/hyphen/digit counts, IP-literal
  host, `@` in URL, punycode, Shannon entropy, TLD risk score, HTTPS,
  port, path depth, hex-ratio, etc.) and brand features (`url/brand.ts`:
  brand-in-subdomain, brand-in-path, brand-lookalike distance).
- **Stage 2 (indices 27–52, full page)** — computed by the content script
  once the DOM is available. Adds DOM-structure features (`dom/structure.ts`:
  password inputs, external form actions, external script/anchor ratios,
  iframes, hidden inputs, favicon origin, meta-refresh, title/brand
  mismatch, node count, form-added-after-load, password-in-iframe, onsubmit
  handler count) and content features (`dom/content.ts`: visible text length,
  text-to-HTML ratio, urgency/credential/financial keyword counts, and a
  `<html lang>` vs. country-TLD mismatch check).

Supporting building blocks:

- **`url/homoglyphs.ts`** — folds digit/Cyrillic/Greek lookalike characters
  and multi-character sequences (e.g. `rn` → `m`) to Latin, then computes a
  restricted Damerau-Levenshtein edit distance.
- **`url/brand.ts`** — normalizes that edit distance against ~250 curated
  brand tokens (`data/brands.json`) to detect lookalike domains
  (`paypa1-login.com` vs. `paypal.com`).
- **`data/bloom.ts`** — a custom binary Bloom filter ("TBLM" format) built
  offline by `pipeline/build_bloom.py`, checked against the Tranco top-50k
  domain list. This is deliberately used only **as one more feature**
  (`in_tranco_50k`), not as an auto-trust allowlist — a lookalike domain
  hosted on otherwise "reputable" infrastructure still gets scored normally.
- **`extract.ts`** — `extractStage1(url, options)` and
  `extractStage2(url, doc, options)` are the two public entry points. Every
  sub-extractor is wrapped in try/catch that pushes to a `warnings`
  side-channel instead of throwing, so a single broken extractor never
  crashes scoring.

### 2. Scoring — `packages/heuristics`

- **`rules.ts`** defines **32 independent, weighted rules** (weights
  0.05–0.7), each a `{ test(features, ctx), human(ctx), weight }` predicate
  over the feature vector — e.g. `URL_IP_HOST` (0.5), `URL_BRAND_LOOKALIKE`
  (0.6), `URL_PUNYCODE` (0.35), `DOM_PASSWORD_EXTERNAL_ACTION` (0.7),
  `CONTENT_URGENCY`, `CONTENT_CREDENTIAL`, `CONTENT_FINANCIAL`,
  `CONTENT_LANG_MISMATCH`.
- **`score.ts::scoreHeuristic`** combines every rule that fires using a
  **noisy-OR**: `score = 1 - Π(1 - weight_i)`. This is monotonic and
  saturating — several weak signals compound, but the score can never exceed
  1 — rather than a simple (unbounded) weighted sum.
- **`verdict.ts::levelForScore`** maps the score to a level using
  per-user-configurable thresholds (`Settings.thresholds`, default
  `{ medium: 0.35, high: 0.75 }`): `score ≥ high → HIGH`,
  `score ≥ medium → MEDIUM`, else `LOW`.
- **`overrides.ts::hardOverride`** applies **raise-only** hard rules after
  scoring — they can never lower a verdict, only escalate it: an IP-literal
  host with a password field, or punycode + brand-in-subdomain, or a very
  close brand-lookalike host (distance < 0.15) with a password field, all
  force `HIGH`; an external password-form action forces at least `MEDIUM`.
- **`verdict.ts::toVerdict`** ties it together and applies the **allowlist
  short-circuit**: if the page's eTLD+1 is in `Settings.allowlist`, the
  verdict is forced to `LOW` with a single `ALLOWLISTED` reason, regardless
  of what the rules would have said.
- **`copy.ts`** maps every rule code to a plain-English, jargon-free
  explanation (no "entropy", no "eTLD" in user-facing text), parameterized
  by the detected brand/host — e.g. _"The address looks almost exactly like
  Xero, but it is xero-secure-login.com."_

### 3. Stage merge — `apps/extension/src/background/scoring.ts`

`mergeVerdicts(stage1, stage2)` decides the **final** verdict shown to the
user:

- A stage-1 `HIGH` is **never downgraded** by stage 2.
- A confident-clean stage-2 result (score < 0.15) can **rescue** a stage-1
  `MEDIUM` false positive.
- Otherwise, the higher-ranked level of the two wins.

If stage 2 never arrives (content script blocked, extraction taking too
long), `service-worker.ts` finalizes on stage 1 alone after a
`STAGE2_TIMEOUT_MS` (1500ms) timeout — so the badge/UI never blocks
indefinitely waiting on DOM extraction.

---

## Function / module reference

### `apps/extension/src/background/` (service worker)

| File                | Key exports                                                                                                                 | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `service-worker.ts` | `isScorable`, `runStage1`, `finalizeOnTimeout`, `handleMessage`                                                             | Entry point. Registers `webNavigation`/`tabs`/`runtime.onMessage` listeners. `runStage1` extracts+scores on `onBeforeNavigate` and writes the tab's initial `TabState`. `finalizeOnTimeout` locks in stage 1 if stage 2 never lands in time. `handleMessage` is the big switch handling every message type (`GET_TAB_STATE`, `GET_SETTINGS`, `SET_ENABLED`, `MANUAL_CHECK`, `SCORE_REQUEST`, `SET_ALLOWLIST`, `PROCEED`, `DISMISS`, `CLOSE_TAB`, `SCORE_RESULT`, `DEEP_SCAN`). |
| `engine.ts`         | `Engine` (interface), `heuristicEngine`                                                                                     | Swappable scoring-engine abstraction. `heuristicEngine` parses the URL, builds a `ScoreContext`, and calls into `@sentinel/heuristics`. This is the intended extension point for a future WASM/ML engine.                                                                                                                                                                                                                                                                      |
| `scoring.ts`        | `isAllowlisted`, `scoreFeatures`, `mergeVerdicts`                                                                           | `scoreFeatures` is the single call site that stamps the extractor version, applies allowlist/thresholds, and invokes the engine. `mergeVerdicts` implements the stage1/stage2 merge rule described above.                                                                                                                                                                                                                                                                      |
| `badge.ts`          | `setBadge`, `clearBadge`                                                                                                    | Sets the toolbar icon color (green/amber/red/grey) and badge text (`!` for MEDIUM/HIGH).                                                                                                                                                                                                                                                                                                                                                                                       |
| `settings.ts`       | `SettingsSchema`, `DEFAULT_SETTINGS`, `getSettings`, `setSettings`, `updateSettings`, `setAllowlisted`, `onSettingsChanged` | Zod-validated `Settings` persisted in `chrome.storage.sync`; self-heals if stored data is corrupted.                                                                                                                                                                                                                                                                                                                                                                           |
| `settings-cache.ts` | `initSettingsCache`, `cachedSettings`, `setCachedSettings`                                                                  | Synchronous in-memory settings cache, refreshed on `storage.onChanged`, so the hot navigation path never awaits storage.                                                                                                                                                                                                                                                                                                                                                       |
| `tab-state.ts`      | `getTabState`, `setTabState`, `patchTabState`, `clearTabState`, `isTabState`                                                | Per-tab `TabState` persisted in `chrome.storage.session` (survives service-worker restarts), keyed `tab:<id>`.                                                                                                                                                                                                                                                                                                                                                                 |

### `apps/extension/src/content/` (content script)

| File                 | Key exports                                                                                                      | What it does                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content-script.ts`  | `hasPasswordField`, `shouldRunHere`, `render`, `requestScore`, `installMutationObserver`, `restoreState`, `init` | `shouldRunHere` restricts sub-frame execution to frames with a password field. `requestScore` extracts stage-2 features, sends `SCORE_REQUEST`, and re-renders. `render` picks interstitial vs. banner vs. nothing based on the verdict. `installMutationObserver` debounces (250ms) re-scoring (max 3x) when a form/password field is added post-load. `init` guards against double-injection via `window.__sentinelInjected`. |
| `submit-guard.ts`    | `installSubmitGuard`                                                                                             | Capture-phase listeners on `submit` and Enter-in-password-field that block the action while a `HIGH` verdict is active and not yet proceeded.                                                                                                                                                                                                                                                                                   |
| `ui/host.ts`         | `getShadowRoot`, `clearUi`                                                                                       | Creates a `<sentinel-root>` custom element with a **closed** shadow root (see [Decision #6](docs/DECISIONS.md)), keeps the root reference module-private, and re-attaches the host if the page removes it. Test builds expose it only through the isolated-world E2E bridge.                                                                                                                                                    |
| `ui/banner.ts`       | `showBanner`                                                                                                     | Dismissable amber `MEDIUM` banner (`role="alertdialog"`) with top reasons, an allowlist button, and Escape-to-dismiss. All buttons and the Escape key only act on trusted input (`event.isTrusted`), so page script cannot dismiss or allowlist.                                                                                                                                                                                |
| `ui/interstitial.ts` | `blockPage`, `showInterstitial`                                                                                  | Full-screen `HIGH` overlay: makes the page `inert`, makes password fields read-only with `autocomplete="off"`, and requires a two-step "I understand the risk, continue" confirmation to proceed. Every action (proceed, confirm-proceed, "Go back") requires trusted input (`event.isTrusted`).                                                                                                                                |
| `tamper-guard.ts`    | `installTamperGuard`                                                                                             | While HIGH and un-proceeded, a `MutationObserver` (attribute + childList) re-applies `inert`/`readonly`/`autocomplete="off"` and re-renders the overlay if the page strips them or injects new password inputs.                                                                                                                                                                                                                 |
| `ui/trusted.ts`      | `onTrustedClick`, `isTrustedEvent`                                                                               | Shared guards that drop synthetic (`isTrusted === false`) click/keydown events.                                                                                                                                                                                                                                                                                                                                                 |
| `ui/styles.ts`       | `UI_STYLES`                                                                                                      | Inline CSS injected into the shadow root (`:host { all: initial; }`, max z-index) — no external stylesheet, for CSP/isolation.                                                                                                                                                                                                                                                                                                  |

### `apps/extension/src/popup/main.ts`

`resolveTabId`, `renderVerdictCard`, `renderReasons`, `renderFooter`,
`normaliseUrl`, `renderQuickResult`, `main` — renders the current tab's
verdict card (level, score %, top reasons), the engine/version/timing
footer, the global-enable and per-site-allowlist toggles, and a manual
"Check a link" box (`MANUAL_CHECK` message, stage-1-only).

### `apps/extension/src/shared/`

- **`types.ts`** — `TabState` interface, `createTabState()`.
- **`messages.ts`** — the `Message` discriminated union (11 message types),
  `ResponseMap`, `sendMessage<T>()` typed wrapper, `isMessage()` runtime
  guard. This is the single source of truth for the cross-context contract.
- **`constants.ts`** — shared constants (e.g. `EXTENSION_NAME`).

### `packages/heuristics/src/`

- **`types.ts`** — `VerdictLevel`, `Reason`, `Thresholds`, `Verdict`,
  `DEFAULT_THRESHOLDS`, `ScoreContext`.
- **`rules.ts`** — the 32-rule table (see above).
- **`score.ts`** — `scoreHeuristic` (noisy-OR combination).
- **`overrides.ts`** — `hardOverride` (raise-only escalation rules).
- **`verdict.ts`** — `levelForScore`, `maxLevel`, `toVerdict`.
- **`copy.ts`** — `COPY`, `reasonText` (plain-English rule explanations).
- **`index.ts`** — barrel export of all of the above.

### `packages/features/src/`

- **`version.ts`** — `EXTRACTOR_VERSION`, `FEATURE_COUNT` (53),
  `FEATURE_NAMES`, `FEATURE_INDEX`.
- **`url/parse.ts`** — `parseUrl` (via `tldts`), `isIpHost`.
- **`url/lexical.ts`** — `shannonEntropy`, `countOccurrences`, `tldRiskFor`,
  `writeLexicalFeatures`.
- **`url/brand.ts`** — `hasBrandInSubdomain`, `hasBrandInPath`,
  `findBrandToken`, `brandLookalikeHost`, `writeBrandFeatures`.
- **`url/homoglyphs.ts`** — `foldHomoglyphs`, `damerauLevenshtein`,
  `normalizedDistance`.
- **`dom/structure.ts`** — `writeDomFeatures` (forms, password inputs,
  external ratios, iframes, favicon, meta-refresh, title/brand mismatch,
  node count, form-added-after-load, onsubmit handlers).
- **`dom/content.ts`** — `writeContentFeatures` (`visibleText`, urgency/
  credential/financial term counts, text-to-HTML ratio, lang/TLD mismatch).
- **`data/bloom.ts`** — `TrancoBloom`, `parseBloom` (custom "TBLM" binary
  format, shared with `pipeline/build_bloom.py`).
- **`data/keywords.ts`** — keyword lists + counters
  (`countUrgencyTerms`/`countCredentialTerms`/`countFinancialTerms`).
- **`data/shorteners.ts`** — `SHORTENERS`, `isUrlShortener`.
- **`extract.ts`** — `extractStage1`, `extractStage2`, `writeUrlFeatures`
  (fail-soft extraction with a `warnings` side-channel).
- **`bin/`** — `extract.ts` (Node CLI bridge for the Python pipeline),
  `bench.ts` (perf benchmark → `docs/LATENCY.md`), `golden.ts` (regenerates
  golden DOM fixtures).

### `packages/engine-wasm/src/lib.rs`

Currently a **stub**: `version()` and a trivial `add(a, b)`. The real
gradient-boosted-tree evaluator, model-format parser, and `predict()`/
`contributions()` API described in the PRD are **not implemented yet** — see
[Current status & known gaps](#current-status--known-gaps).

---

## Data flow walkthrough (a real navigation)

1. User navigates to a URL. `chrome.webNavigation.onBeforeNavigate` fires
   (main frame only) → `service-worker.ts::runStage1()`: `extractStage1(url)`
   → `scoreFeatures(heuristicEngine, ...)` → a `Verdict` is stored as both
   `stage1` and (provisionally) `final` in a fresh `TabState`
   (`chrome.storage.session`); the badge updates immediately (target: ≤50ms).
2. `onCompleted` fires → a 1500ms timeout starts. If stage 2 never reports,
   `finalizeOnTimeout()` locks in stage 1 as final.
3. The content script loads at `document_idle` in every frame.
   `shouldRunHere()` restricts sub-frame execution to frames with a password
   field. It restores `dismissed`/`proceeded` flags via `GET_TAB_STATE`, then
   calls `requestScore(false)`: `extractStage2(url, document, ...)` builds the
   full 53-feature vector and sends it to the service worker as a
   `SCORE_REQUEST` message.
4. The service worker re-scores via `scoreFeatures()`, merges with the
   existing stage-1 verdict via `mergeVerdicts()`, persists the updated
   `TabState` (`stage2` + `final`), updates the badge, and returns the final
   `Verdict` to the content script.
5. The content script's `render()` reacts to the verdict:
   - **HIGH, not proceeded** → full-page interstitial (page `inert`,
     password fields read-only, submits blocked by `submit-guard.ts`). The
     block is re-asserted by `tamper-guard.ts` whenever the page removes
     `inert`/`readonly`/the overlay or injects new password inputs.
   - **HIGH, proceeded** → a banner reminding the user they proceeded.
   - **MEDIUM** → a dismissable banner with top reasons and an allowlist
     button.
   - **LOW / none** → no UI; just the green badge.
6. A `MutationObserver` watches for late-added forms/password fields
   (debounced 250ms, capped at 3 rescores) and re-runs
   `requestScore(true)`, so phishing kits that inject a form after page load
   still get caught.
7. **Popup**: on open, queries `GET_TAB_STATE` and `GET_SETTINGS`, then
   renders the verdict card, a footer (engine name, extractor/model version,
   stage-1 timing), the enable/allowlist toggles, and a manual "Check a
   link" box (`MANUAL_CHECK`, stage-1-only — the PRD's "Deep scan" flow is
   not implemented; the `DEEP_SCAN` message handler is a stub returning
   `UNKNOWN`).
8. **Allowlisting**: the popup's toggle or the banner's "This site is safe"
   button sends `SET_ALLOWLIST`, updating `Settings.allowlist` in
   `chrome.storage.sync` and forcing the current tab's badge to `LOW`.

---

## Manifest & permissions

From `apps/extension/manifest.config.ts` (MV3):

| Permission                                  | Why                                                                                                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `webNavigation`                             | Intercept every navigation for stage-1 scoring.                                                                                                            |
| `storage`                                   | Settings (`sync`) + per-tab state (`session`).                                                                                                             |
| `tabs`                                      | Query/remove tabs (`CLOSE_TAB`, popup's active-tab lookup).                                                                                                |
| `scripting`                                 | MV3 content-script/dynamic injection support (used by crxjs).                                                                                              |
| `offscreen`                                 | Reserved for the planned "Deep scan" offscreen-`DOMParser` flow — not yet used by any implemented code path.                                               |
| `host_permissions: <all_urls>`              | Every navigation to any site must be scorable. Flagged in the PRD as a Chrome Web Store review risk, with `activeTab` documented as a possible mitigation. |
| CSP: `script-src 'self' 'wasm-unsafe-eval'` | `'wasm-unsafe-eval'` is required to instantiate the (future) WASM inference module.                                                                        |

`content_scripts` match `<all_urls>`, run in `all_frames`, at
`run_at: document_idle` (catches sub-frame login forms; reads the DOM only
after the first render pass). `web_accessible_resources` ends up non-empty
in the **built** manifest because `@crxjs/vite-plugin` needs its
content-script loader chunks to be web-accessible ([Decision #3](docs/DECISIONS.md)).

---

## Build, test, and tooling

- **Package manager**: pnpm workspaces (`apps/*`, `packages/*`, `tests/*`).
- **Extension bundler**: Vite + `@crxjs/vite-plugin` (MV3-aware), targets
  `chrome120`.
- **Language**: TypeScript (strict), shared `tsconfig.base.json`.
- **Validation**: `zod` for the `Settings` schema.
- **Lint/format**: ESLint + Prettier.
- **Unit tests**: Vitest (+ jsdom for DOM-dependent feature tests):
  - `apps/extension/test/` — background modules (`badge`, `engine`,
    `messages`, `scoring`, `settings`, `settings-cache`, `tab-state`), with
    `chrome-mock.ts` mocking the `chrome.*` API surface.
  - `packages/features/src/**/*.test.ts` — every extractor, plus
    `dom/golden.test.ts` (golden-file DOM feature snapshots against
    `fixtures/golden/dom/*.json`).
  - `packages/heuristics/src/*.test.ts` — rule/score/verdict tests, including
    a "no jargon in copy" check.
- **E2E tests** (Playwright, `tests/e2e/`, drives a real unpacked build via
  `chromium.launchPersistentContext` with `--load-extension`):
  `smoke.spec.ts`, `verdict.spec.ts` (spoof-domain scenarios via host-alias
  DNS mapping), `corpus.spec.ts` (25-page verdict corpus), `ui.spec.ts`,
  `a11y.spec.ts` (axe-core scans of the banner/interstitial), `latency.spec.ts`
  (asserts p95 ≤ 50ms stage1 / ≤ 400ms stage2, feeds `docs/LATENCY.md`), and
  `no-network.spec.ts` (asserts **zero** real network requests originate from
  the extension while browsing fixture pages — the privacy guarantee).
- **Rust/WASM**: Cargo workspace, `wasm32-unknown-unknown` target,
  `wasm-pack` for packaging (`packages/engine-wasm/pkg/`).
- **Python pipeline**: `uv`-managed, `ruff`-linted, `pytest`-tested
  (`pipeline/tests/`).
- **Bundle-size budgets**: `size-limit` (`.size-limit.json`) — WASM engine
  ≤1MB, `model.bin` ≤600KB, total dist ≤3MB.
- **Packaging**: `scripts/pack-zip.mjs` zips `apps/extension/dist` into
  `artifacts/sentinel-<version>.zip`.
- **CI** (`.github/workflows/ci.yml`): 4 parallel jobs —
  `node` (check/build/size), `wasm` (cargo test + wasm-pack build),
  `python` (ruff + pytest), `e2e` (Playwright, with an artifact upload of the
  HTML report).

Root convenience scripts (see `package.json`) include a combined `check`
(`format:check && typecheck && lint && test:coverage`).

---

## Current status & known gaps

- **Detection engine**: only the TypeScript heuristic engine
  (`packages/heuristics`) is wired up. The Rust/WASM ML engine
  (`packages/engine-wasm`) is a stub; `apps/extension/public/model.bin` is an
  inert placeholder not consumed by any code path yet.
- **Deep scan**: the PRD describes a "Deep scan" flow (fetch + offscreen
  `DOMParser` parse for a manual, deeper check). The `DEEP_SCAN` message
  handler currently just returns `UNKNOWN` — unimplemented.
- **Python pipeline**: only `build_bloom.py` is implemented; `collect/`,
  `crawl/`, `extract/`, `split/`, `train/`, `export/` are empty scaffolds —
  the offline training pipeline for the future ML model hasn't been built.
- **Bundle size**: per `CHANGELOG.md`, the content-script bundle currently
  exceeds the V1 60KB-gzipped target; tree-shaking is a deferred cleanup
  item.
- **No AGENT-CHECKLIST-v1.md**: the PRD references this as a "next document,"
  but it does not exist in the repo yet.

---

## Where to look next

- [`PRD-phishing-extension-v1.md`](PRD-phishing-extension-v1.md) — the full
  product/technical spec: problem statement, functional & non-functional
  requirements, the complete 53-feature table, UX copy rules, and the V0/V1
  release plan.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — ADR-style log of key
  architectural decisions and why they were made.
- [`docs/LATENCY.md`](docs/LATENCY.md) — running benchmark log (stage1/stage2
  extraction and scoring latency per build phase).
- [`docs/INSTALL-TESTERS.md`](docs/INSTALL-TESTERS.md) — how to build and
  load the extension for manual testing, and how to report false
  positives/misses.
- [`CHANGELOG.md`](CHANGELOG.md) — release notes per version.

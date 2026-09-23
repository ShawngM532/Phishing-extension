# Decisions

Running log of decisions made during the build. One entry per decision. Newest at the bottom.

Format: **#N — Title** · date · status · context · decision · consequences.

---

## #1 — Stack: TypeScript extension + Rust/WASM inference + Python training

**Date:** 2026-09-14
**Status:** Accepted
**Source:** PRD §9

**Context.** We need an MV3 Chrome extension that scores pages on-device in under a second, with a model that can be swapped without shipping code. Candidate inference runtimes were ONNX Runtime Web, TensorFlow.js, and a purpose-built WASM evaluator.

**Decision.** TypeScript for all extension glue (Vite + `@crxjs/vite-plugin`), a hand-written gradient-boosted-tree evaluator in Rust compiled to `wasm32-unknown-unknown` via `wasm-bindgen`, and Python (LightGBM) for offline training. Feature extraction lives once, in TypeScript (`packages/features`), and the Python pipeline shells out to it through Node so training and runtime share an identical feature definition.

**Why not ONNX Runtime Web / TF.js.** Both are multi-megabyte runtimes with non-trivial instantiation cost. An MV3 service worker is killed after ~30 s idle and restarted frequently; a 5–10 MB runtime with a slow cold start is unacceptable. A tree-ensemble walker compiles to well under 150 KB, instantiates in < 5 ms, and evaluates a few hundred trees in tens of microseconds.

**Consequences.**

- The model export format is custom and versioned (`format_version`, `extractor_version`, `model_version`); we own the parser (`packages/engine-wasm/src/format.rs`).
- `EXTRACTOR_VERSION` must be bumped whenever feature semantics change, and the model must be retrained; the WASM engine refuses to load a model whose extractor version mismatches.
- A TypeScript heuristic engine (`packages/heuristics`) is kept as a permanent fallback for when the model is missing, corrupt, or mismatched.

---

## #2 — MV3 entry files use unique basenames (`service-worker.ts`, `content-script.ts`)

**Date:** 2026-09-14
**Status:** Accepted
**Source:** AGENT-CHECKLIST §2.1 (which names `src/background/index.ts` and `src/content/index.ts`)

**Context.** With both entries named `index.ts`, `@crxjs/vite-plugin` 2.7.1 emits colliding chunk names and the generated `service-worker-loader.js` imported the _content script_ chunk instead of the background chunk. Result: zero background listeners registered, no tab state, and the smoke test failed. Confirmed by inspecting `dist/service-worker-loader.js` and the emitted chunks.

**Decision.** Rename the two entries to unique basenames: `src/background/service-worker.ts` and `src/content/content-script.ts`. The manifest points at the new paths. Functionally identical to the checklist; only the file names differ.

**Consequences.** Anyone following the checklist literally will look for `index.ts`; the manifest is the source of truth.

---

## #3 — `web_accessible_resources` is non-empty (crxjs requirement)

**Date:** 2026-09-14
**Status:** Accepted
**Source:** AGENT-CHECKLIST §2.1 (asks for none)

**Context.** The checklist asks for `web_accessible_resources: none`. crxjs splits each content script into a tiny loader that `import()`s the real chunk at runtime; Chrome requires dynamically imported content-script chunks to be listed as web-accessible. The built manifest therefore lists the content-script and shared-message chunks.

**Decision.** Accept the crxjs-generated `web_accessible_resources`. They only expose our own static bundles (no page-derived data, no remote code), so the security posture is unchanged. Revisit if we stop using crxjs or configure it to inline content scripts.

**Consequences.** The zero-network test is the real guarantee that no page or extension data leaves the browser.

---

## #4 — e2e background readiness gate

**Date:** 2026-09-14
**Status:** Accepted

**Context.** When Playwright launches a persistent context and immediately navigates, the first `webNavigation.onBeforeNavigate` can fire before the extension service worker has evaluated its module and registered listeners, so the event is missed. This is a test-harness race, not a product bug.

**Decision.** The `extensionId` fixture polls `chrome.webNavigation.onBeforeNavigate.hasListeners()` in the service worker until the background module is ready before tests navigate.

**Consequences.** Every e2e test that requests `extensionId` is race-free.

---

## #5 — Shadow root is `open` for V0, not `closed`

**Date:** 2026-09-14
**Status:** Superseded by #6 (2026-09-23)
**Source:** PRD §8 and AGENT-CHECKLIST §5.5 ask for a closed shadow root.

**Context.** A closed shadow root cannot be inspected or driven by Playwright, so the banner/interstitial e2e tests in §5.6/§5.7 could not assert visibility or click buttons. The only alternatives were a test-only bridge (fragile) or losing the closed-root security property.

**Decision.** Use `mode: 'open'` for the V0 UI. The host still uses `all: initial`, inline styles and max z-index; page CSS cannot leak in. The page can, however, reach the shadow root via JS.

**Consequences.** Restoring `closed` (with a proper test bridge or CDP access) is tracked as a Phase 11 hardening item. The threat model in `docs/THREAT-MODEL.md` must note this.

---

## #6 — Shadow root is `closed`, with an isolated-world E2E bridge

**Date:** 2026-09-23
**Status:** Accepted
**Supersedes:** #5
**Source:** AGENT-CHECKLIST-v1 §1.1; PRD §8.

**Context.** ADR #5 chose an open shadow root so Playwright could inspect and drive the warning UI, accepting that page script could reach the root. The attacker controls the page, so an open root lets it click "continue", strip `readonly`/`inert`, or otherwise defeat the block. The checklist makes closing the root a Phase 1 security requirement.

**Decision.** Attach the root with `mode: 'closed'` (`content/ui/host.ts`) and keep the reference module-private. The E2E suite drives the UI through a test-only bridge (`content/e2e-bridge.ts`) that:

- is installed only when the build flag `__SENTINEL_E2E__` is true, set by Vite `--mode e2e` (`build:e2e` script);
- is a `chrome.runtime.onMessage` listener in the content script's isolated world, reached from the spec via `chrome.tabs.sendMessage(tabId, …, { frameId: 0 })` — never a page-world global;
- supports querying a selector or text (count/visibility/rect), returning the shadow HTML for an axe mirror, and clicking via coordinates.

Because programmatic `element.click()` produces an untrusted event, the specs drive trusted clicks with `page.mouse.click(x, y)` at the rect returned by the bridge.

**Consequences.**

- Production builds contain no bridge: CI greps `apps/extension/dist` for `E2E_UI` and fails if it appears.
- The E2E job now builds with `pnpm build:e2e`; the default `pnpm build` stays production.
- axe can no longer traverse the root directly, so the a11y specs mirror the shadow HTML into a temporary open shadow root before analysis (same markup, same inline styles).
- A dedicated spec (`tests/e2e/shadow-root.spec.ts`) asserts `document.querySelector('sentinel-root')?.shadowRoot === null` in the page world.

---

## #7 — Web-accessible resources stay; dynamic URL rejected

**Date:** 2026-09-23
**Status:** Accepted
**Source:** AGENT-CHECKLIST-v1 §1.5; amends #3.

**Context.** `@crxjs/vite-plugin` splits each content script into a tiny loader that `import()`s the real chunk, so those chunks must be listed in `web_accessible_resources` (ADR #3). A page can therefore probe for `chrome-extension://<id>/assets/<chunk>` and detect that Sentinel is installed. We cannot remove the entries without replacing crxjs or inlining the content script, and `matches` cannot be narrowed below `<all_urls>` because the content script runs on every site.

**Decision.** Keep the crxjs-generated entries and reduce the surface only where crxjs allows: a Vite `closeBundle` plugin (`hardenWebAccessibleResources` in `apps/extension/vite.config.ts`) drops the `.map` source maps from the list.

`use_dynamic_url: true` was attempted and **reverted**: crxjs's loader calls `chrome.runtime.getURL("assets/content-script….js")`, which resolves the static path, and Chrome then refuses it ("Resources must be listed in web_accessible_resources"), so the content script never runs — verified by the page-console error and failing e2e spec. Narrowing `matches` would likewise break injection on unlisted sites. Both are accepted residual risks.

**Consequences.**

- The extension is still detectable: a page can observe content-script injection and can fetch the listed web-accessible chunks. This residual risk is accepted for V0/V1 given the on-device, zero-network privacy model — nothing about the user or page is exposed, and the chunks contain no page-derived data.
- `tests/e2e/fingerprint.spec.ts` asserts the built manifest lists no `.map` resources (the hardening we could apply).

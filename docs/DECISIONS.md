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
**Status:** Accepted (temporary)
**Source:** PRD §8 and AGENT-CHECKLIST §5.5 ask for a closed shadow root.

**Context.** A closed shadow root cannot be inspected or driven by Playwright, so the banner/interstitial e2e tests in §5.6/§5.7 could not assert visibility or click buttons. The only alternatives were a test-only bridge (fragile) or losing the closed-root security property.

**Decision.** Use `mode: 'open'` for the V0 UI. The host still uses `all: initial`, inline styles and max z-index; page CSS cannot leak in. The page can, however, reach the shadow root via JS.

**Consequences.** Restoring `closed` (with a proper test bridge or CDP access) is tracked as a Phase 11 hardening item. The threat model in `docs/THREAT-MODEL.md` must note this.

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

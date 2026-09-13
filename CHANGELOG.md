# Changelog

## v0.1.0 — V0 heuristic MVP (2026-09-14)

First end-to-end V0: a working Chrome MV3 extension that scores pages on-device with a
weighted heuristic engine and warns before a password is submitted.

### Added

- **Monorepo and toolchain.** pnpm workspaces, strict TypeScript, ESLint + Prettier, Vitest
  coverage gates, Rust→WASM crate, uv-managed Python pipeline, GitHub Actions CI, size budgets.
- **MV3 extension shell.** Typed message bus, per-tab state in `storage.session`, zod-validated
  settings in `storage.sync`, badge controller with four icon sets, content script and popup.
- **Feature extraction (`packages/features`).** All 53 PRD §10 features, brand lookalike detection
  with homoglyph folding, TLD-risk table, keyword tables, cross-language Tranco Bloom filter,
  golden-file tests, Node CLI bridge and a benchmark.
- **Heuristic engine (`packages/heuristics`).** 32 weighted rules with noisy-OR scoring, hard
  overrides, verdict builder and plain-English reason copy.
- **Verdict pipeline and UX.** Stage 1 on navigation, stage 2 at `document_idle` with mutation
  rescoring, final-verdict merge, 1.5 s timeout guard, shadow-DOM banner and HIGH interstitial,
  submit interceptor, allowlist, global disable, popup quick-check.
- **Tests.** 152 feature unit tests, 55 heuristic tests, 27 extension tests, 33 Playwright e2e
  tests (corpus, UI, accessibility, zero-network) and a 25-page verdict corpus.

### Known limitations

- The inference engine is the TypeScript heuristic; the trained WASM model lands in V1.
- The shadow root is `open` in V0 (see `docs/DECISIONS.md` #5).
- The content-script bundle exceeds the V1 60 KB gzipped budget; tree-shaking is Phase 10.

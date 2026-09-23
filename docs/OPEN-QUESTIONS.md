# Open questions

Blockers and ambiguities encountered while following `AGENT-CHECKLIST-v1.md`.
Per rules of engagement #9, work stopped and the question is recorded here
instead of guessing.

---

## B1 — Tranco top-50k dataset is not in the repo (blocks 2.1, 2.4)

**Status:** open · found 2026-09-23 (Phase 0 item 0.8, REFUTED)

**What.** `pipeline/build_bloom.py` downloads the Tranco top-1M list and builds
`apps/extension/public/tranco.bloom` (and `tranco.meta.json`). Neither the list
nor a real built filter is committed; `apps/extension/public/` holds only
`icons/` and a 0-byte `model.bin`. The only Bloom artifact in the repo is the
1,214-byte synthetic fixture `fixtures/bloom/bloom.bin` (1000 `member-N.example`
entries), which is not Tranco data.

**Why it blocks.**

- `runStage1`/`requestScore` never pass `options.bloom`, so `in_tranco_50k` is
  always 0 in the extension (`apps/extension/src/background/service-worker.ts:48`,
  `apps/extension/src/content/content-script.ts:99`).
- Task 2.1's PRD §10.4 rule `password_form_action_external && !in_tranco_50k(action host)`
  cannot be evaluated without a real Tranco membership test for the action host.
- Task 2.4's cold-start acceptance asserts the correct `in_tranco_50k` value for a
  Tranco site; the fixture cannot supply a real one.

**Question.** Which does the owner prefer?

1. Commit the actual Tranco top-50k-derived `tranco.bloom` + `tranco.meta.json`
   (and pin the list date/id) so it can be bundled and tested; or
2. Provide network access at build time and document a regeneration cadence; or
3. Accept the synthetic fixture for now, ship the loading/readiness
   infrastructure, and track real data as a release blocker.

Everything else in 2.4 (the `ready()` barrier for the settings cache and the
Bloom, the `TabState.timings` instrumentation) is independent of this choice.

---

## B2 — Phase 3 datasets and feeds are unavailable offline (blocks 3.x, 5.x)

**Status:** open · found 2026-09-23

**What.** Phase 3 requires crawling PhishTank (verified-online) and OpenPhish
feeds within hours of publication, sampling Tranco top-1M benign homepages, and
hand-reviewing ~2,000 real benign login pages (`pipeline/collect/`). Phase 5
requires training on those splits. None of this data is in the repo and the
environment has no network access.

**Question.** Provide the feeds/datasets (or network access and a sanctioned
crawl schedule), or explicitly defer Phases 3–5. The Phase 3 harness _code_
(`crawl/`, `collect/`, `split/`, `eval/`) can be written and unit-tested against
recorded fixtures without the live data.

---

## B3 — Does `model.bin` ship a real model or stay absent until Phase 5?

**Status:** open · found 2026-09-23

The file is 0 bytes. Its `size-limit` budget (≤ 600 KB) passes vacuously. Task
5.5 needs a real exported model; until then the popup footer should show the
heuristic engine and the README should not imply a bundled model. Confirm the
intended interim state (absent vs. a committed dummy with a version header).

---

## Q1 — Branch/merge flow for this autonomous run

The checklist says "one task = one branch = one PR". With no reviewer in the
loop, each completed task branch
(`chk/0-audit-2026-09`, `chk/1.1-closed-shadow-root`, …) was fast-forward
merged into `main` so the next task could stack on it. Confirm whether you want
PRs opened instead (the branches are preserved), or the fast-forward flow.

---

## Resolved inline (recorded for traceability)

- **0.4 dead features — REFUTED.** `anchor_null_ratio`,
  `copyright_brand_mismatch` and `login_form_on_http` are all computed
  (`packages/features/src/dom/structure.ts:113-117,135-137,139-140`). Task 2.9
  collapses to a golden-fixture/README verification, no extractor work.
- **1.1 ADR.** `use_dynamic_url` superseded by `closed` root + E2E bridge →
  Decision #6.
- **1.5 ADR.** `use_dynamic_url: true` breaks crxjs's loader; resource
  `matches` cannot be narrowed below `<all_urls>`. Accepted residual
  fingerprinting risk → Decision #7.

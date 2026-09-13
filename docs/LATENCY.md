# Latency log

Every phase that touches the hot path appends a row. Target budgets from PRD §8.

| Date       | Phase | What was measured                                                                | p50          | p95          | Budget       | Notes                                                                                                                                               |
| ---------- | ----- | -------------------------------------------------------------------------------- | ------------ | ------------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-14 | 1     | toolchain baseline                                                               | —            | —            | —            | No hot-path code yet.                                                                                                                               |
| 2026-09-14 | 3     | Stage 1 extraction, 10,000 unique URLs, median of 5 rounds                       | 0.108 ms/URL | 0.223 ms/URL | ≤ 0.2 ms/URL | p50 well under; p95 marginally over the extractor micro-target (V8 GC/JIT tail). PRD navigation budget (stage 1 p95 ≤ 50 ms) met with ~200× margin. |
| 2026-09-14 | 3     | Stage 2 extraction, 17 fixtures × 100, median of 5 rounds (jsdom parse excluded) | 0.43 ms      | 0.82 ms      | ≤ 40 ms      | Largest golden fixture is 23 nodes; the 5k-node target is exercised in Phase 5/10.                                                                  |

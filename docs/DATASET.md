# Dataset

Frozen 2026-09-28T03:05:13+00:00.

## Collection store (local, gitignored)

- Phishing URLs discovered: **300**
- Curated benign URLs: **109**
- Crawl results: **8**
- `first_seen` dates: 2026-09-28

Layout: `data/raw/` (feed URLs), `data/crawled/` (crawl metadata),
`data/html/` (content-addressed HTML). See `docs/COLLECTION.md`.

## Artifact hashes

| Path | SHA-256 | Bytes |
| --- | --- | --- |
| `raw/benign_2026-09-28.parquet` | `ec9feb1998d47d2b5cf25229f1b5774ab7efaa2569819ff340bb6e9d800a2fdb` | 4449 |
| `raw/openphish_2026-09-28.parquet` | `06145035408b2647c7ad8b442bf5e7c1a7c4dd0a635f8a2001d7a638da14a1ec` | 11234 |
| `crawled/crawl_2026-09-28T024900.parquet` | `0f9a4304de61757e2b5ae8178c62753e90864971d6f3071a09856890af0cd138` | 8703 |
| `crawled/crawl_2026-09-28T030411.parquet` | `29405793cd0f0ba7445e35bff79ffeba1c16bbbc379707368f5924cdb07d2d1d` | 7314 |

## Committed fixture subset

The repository commits only synthetic, safe fixtures for CI reproducibility: the 25-page verdict corpus under `fixtures/pages/corpus/` plus the golden DOM fixtures. Real crawled phishing HTML is **not** committed (it is malicious content and large); it stays in the local store and is identified by the hashes above.

## Splits

Not yet frozen. A real temporal split (`train < T`, `val [T, T+14d)`, `test [T+14d, T+28d)`) requires the collector to run for ~6 weeks so that `first_seen` spans the cutoffs. See `docs/COLLECTION.md`.

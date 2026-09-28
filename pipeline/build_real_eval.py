"""Materialize a real-world eval set from the collection store.

Unlike `fixtures/pages/corpus/` (author-written, used for the CI regression
gate), this pulls real crawled URLs and HTML from `data/crawled/` +
`data/html/` and writes a JSONL the eval harness can score with
`run_eval.py --input`. Small N is expected: most phishing URLs die before the
crawler reaches them.

Usage:
  uv run python build_real_eval.py
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from eval.dataset import LABEL_BENIGN, LABEL_PHISHING, EvalRow, write_jsonl
from settings import load_settings
from storage import read_crawled, read_raw_benign, read_raw_phishing

PIPELINE_ROOT = Path(__file__).resolve().parent


def _first_seen_map(settings) -> dict[str, str]:
    phishing = read_raw_phishing(settings)
    benign = read_raw_benign(settings)
    mapping: dict[str, str] = {}
    for frame in (phishing, benign):
        for _, row in frame.iterrows():
            url = row.get("url")
            seen = row.get("first_seen")
            if isinstance(url, str) and seen is not None:
                mapping[url] = str(seen)
    return mapping


def build_rows(settings) -> list[EvalRow]:
    crawled = read_crawled(settings)
    first_seen = _first_seen_map(settings)
    data_dir = settings.resolve(settings.paths.data_dir)

    rows: list[EvalRow] = []
    for _, record in crawled.iterrows():
        if record.get("status") != 200:
            continue
        html_file = record.get("html_file")
        if not isinstance(html_file, str) or not html_file:
            continue
        html_path = data_dir / html_file
        if not html_path.exists():
            continue
        label_raw = record.get("label")
        if label_raw not in (LABEL_PHISHING, LABEL_BENIGN):
            continue
        url = str(record["url"])
        html = html_path.read_text(encoding="utf-8", errors="replace")
        rows.append(
            EvalRow(
                url=url,
                label=int(label_raw),
                html=html,
                source="collector",
                first_seen=first_seen.get(url),
            )
        )
    return rows


def main() -> None:
    settings = load_settings()
    rows = build_rows(settings)

    n_phish = sum(1 for row in rows if row.label == LABEL_PHISHING)
    n_benign = sum(1 for row in rows if row.label == LABEL_BENIGN)

    stamp = datetime.now(UTC).strftime("%Y-%m-%d")
    out_path = PIPELINE_ROOT / "data" / "eval" / f"real_smoke_{stamp}.jsonl"
    write_jsonl(rows, out_path)

    print(f"[build_real_eval] phishing={n_phish} benign={n_benign} total={len(rows)}")
    print(f"[build_real_eval] wrote {out_path}")
    if len(rows) < 5:
        print("[build_real_eval] WARNING: very small N; report this honestly, do not pad")


if __name__ == "__main__":
    main()

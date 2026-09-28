"""Run the detection evaluation.

Usage:
  uv run python run_eval.py --corpus                 # the 20 benign/phish fixture corpus
  uv run python run_eval.py --input data/frozen.jsonl
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from eval.dataset import EvalRow, from_corpus, read_jsonl
from eval.metrics import summarize
from eval.report import render_markdown
from eval.scoring import score_rows

PIPELINE_ROOT = Path(__file__).resolve().parent
REPO_ROOT = PIPELINE_ROOT.parent
CORPUS_DIR = REPO_ROOT / "fixtures" / "pages" / "corpus"
DEFAULT_OUT_DIR = REPO_ROOT / "docs"


def load_rows(args: argparse.Namespace) -> tuple[str, list[EvalRow]]:
    if args.input:
        path = Path(args.input)
        return f"Evaluation — {path.name}", read_jsonl(path)
    return "Evaluation — fixture corpus (V0 heuristic baseline)", from_corpus(CORPUS_DIR)


def main() -> None:
    parser = argparse.ArgumentParser(description="Sentinel detection evaluation")
    parser.add_argument("--corpus", action="store_true", help="evaluate the fixture corpus")
    parser.add_argument("--input", type=Path, default=None, help="JSONL dataset to evaluate")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    args = parser.parse_args()

    title, rows = load_rows(args)
    records = score_rows(rows)

    labels: list[int] = []
    scores: list[float] = []
    per_row: list[tuple[str, int, float, str]] = []
    errors: list[str] = []

    for row in rows:
        record = records.get(row.url)
        if record is None or "final" not in record:
            reason = "no score" if record is None else str(record.get("error", "unknown error"))
            errors.append(f"`{row.url}` — {reason}")
            continue
        final = record["final"]
        labels.append(row.label)
        scores.append(float(final["score"]))
        per_row.append((row.url, row.label, float(final["score"]), str(final["level"])))

    if not labels:
        raise SystemExit("no scorable rows; nothing to evaluate")

    summary = summarize(labels, scores)
    markdown = render_markdown(title, summary, per_row, errors)

    args.out_dir.mkdir(parents=True, exist_ok=True)
    (args.out_dir / "EVAL.md").write_text(markdown, encoding="utf-8")
    (args.out_dir / "eval-results.json").write_text(
        json.dumps(
            {
                "title": title,
                "summary": summary,
                "rows": [
                    {"url": url, "label": label, "score": score, "level": level}
                    for url, label, score, level in per_row
                ],
                "errors": errors,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(
        f"[eval] n={summary['n']} phishing={summary['n_phishing']} benign={summary['n_benign']} "
        f"roc_auc={summary['roc_auc']} fpr@recall95={summary['fpr_at_recall_95']} "
        f"medium(recall={summary['at_medium']['recall']}, fpr={summary['at_medium']['fpr']}) "
        f"high(recall={summary['at_high']['recall']}, fpr={summary['at_high']['fpr']})"
    )
    print(f"[eval] wrote {args.out_dir / 'EVAL.md'}")


if __name__ == "__main__":
    main()

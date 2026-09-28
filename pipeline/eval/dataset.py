"""Evaluation dataset schema and loaders.

A dataset row is `{url, html, label, source, first_seen}` where `label` is 1 for
phishing and 0 for benign. Datasets are JSONL so they are diff-friendly and can be
frozen with a SHA-256 in `docs/DATASET.md`.
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

LABEL_PHISHING = 1
LABEL_BENIGN = 0

_GROUP_LABEL = {"phish": LABEL_PHISHING, "benign": LABEL_BENIGN}


@dataclass(frozen=True)
class EvalRow:
    url: str
    label: int
    html: str | None
    source: str
    first_seen: str | None = None


def read_jsonl(path: Path) -> list[EvalRow]:
    rows: list[EvalRow] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped == "":
            continue
        record = json.loads(stripped)
        rows.append(
            EvalRow(
                url=str(record["url"]),
                label=int(record["label"]),
                html=record.get("html"),
                source=str(record.get("source", "unknown")),
                first_seen=record.get("first_seen"),
            )
        )
    return rows


def write_jsonl(rows: Iterable[EvalRow], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(
                json.dumps(
                    {
                        "url": row.url,
                        "html": row.html,
                        "label": row.label,
                        "source": row.source,
                        "first_seen": row.first_seen,
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )


def from_corpus(corpus_dir: Path) -> list[EvalRow]:
    """Load the verdict corpus as a labeled set (phish=1, benign=0; edge cases excluded)."""
    cases = json.loads((corpus_dir / "cases.json").read_text(encoding="utf-8"))
    rows: list[EvalRow] = []
    for case in cases:
        group = case.get("group")
        if group not in _GROUP_LABEL:
            continue
        html = (corpus_dir / case["file"]).read_text(encoding="utf-8")
        rows.append(
            EvalRow(
                url=str(case["url"]),
                label=_GROUP_LABEL[group],
                html=html,
                source=f"corpus:{group}",
                first_seen=None,
            )
        )
    return rows

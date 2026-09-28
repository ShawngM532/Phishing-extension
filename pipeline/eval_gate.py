"""CI gate: the committed fixture-corpus evaluation must clear a minimum bar.

This is a regression guard for the harness and the engine, not a quality claim —
the fixture corpus is authored by us. It fails if the pipeline stops producing the
expected separation or if the harness breaks.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

MIN_RECALL_AT_MEDIUM = 0.9
MAX_FPR_AT_MEDIUM = 0.1

DEFAULT_RESULTS = Path(__file__).resolve().parent.parent / "docs" / "eval-results.json"


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_RESULTS
    if not path.exists():
        print(f"[gate] FAIL: results file not found at {path}")
        return 1

    summary = json.loads(path.read_text(encoding="utf-8"))["summary"]
    recall = summary["at_medium"]["recall"]
    fpr = summary["at_medium"]["fpr"]

    ok = recall >= MIN_RECALL_AT_MEDIUM and fpr <= MAX_FPR_AT_MEDIUM
    print(
        f"[gate] {'PASS' if ok else 'FAIL'}: recall@medium={recall} "
        f"(min {MIN_RECALL_AT_MEDIUM}), fpr@medium={fpr} (max {MAX_FPR_AT_MEDIUM})"
    )
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

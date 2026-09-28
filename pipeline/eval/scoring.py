"""Score evaluation rows with the shipping heuristic via the Node bridge.

The bridge (`scripts/score.ts`) reuses the extension's engine and merge logic, so
offline metrics reflect exactly what the browser runs.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from eval.dataset import EvalRow

REPO_ROOT = Path(__file__).resolve().parents[2]


def score_rows(rows: list[EvalRow], repo_root: Path = REPO_ROOT) -> dict[str, dict]:
    """Return `{url: bridge_record}` for every scorable row."""
    if not rows:
        return {}

    payload = "\n".join(
        json.dumps({"url": row.url, "html": row.html or ""}, ensure_ascii=False) for row in rows
    )

    pnpm = shutil.which("pnpm")
    if pnpm is None:
        raise RuntimeError("pnpm was not found on PATH; the scoring bridge needs Node")

    completed = subprocess.run(
        [pnpm, "--silent", "score"],
        input=payload,
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=str(repo_root),
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            f"scoring bridge exited with {completed.returncode}:\n{completed.stderr[-2000:]}"
        )

    records: dict[str, dict] = {}
    for line in completed.stdout.splitlines():
        stripped = line.strip()
        if not stripped.startswith("{"):
            continue
        record = json.loads(stripped)
        url = record.get("url")
        if isinstance(url, str):
            records[url] = record
    return records

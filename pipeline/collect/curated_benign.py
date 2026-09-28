"""Collect the curated benign login/account URLs (label 0).

The list is hand-maintained in `curated_benign.txt` and filtered for reachability by
`verify_urls.py`. The PRD calls this the set that "kills false positives" because
public benign corpora rarely contain real login pages.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import pandas as pd

from settings import Settings
from storage import RAW_PHISHING_COLUMNS, raw_benign_path, seen_urls, write_parquet

SOURCE = "curated"
LABEL_BENIGN = 0
CURATED_FILE = Path(__file__).with_name("curated_benign.txt")


def normalise_url(raw: str) -> str | None:
    parts = urlsplit(raw.strip())
    if parts.scheme.lower() not in {"http", "https"} or not parts.netloc:
        return None
    host = (parts.hostname or "").lower()
    if host == "":
        return None
    return urlunsplit((parts.scheme.lower(), host, parts.path or "/", parts.query, ""))


def load_curated(path: Path = CURATED_FILE) -> list[str]:
    urls: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped == "" or stripped.startswith("#"):
            continue
        normalised = normalise_url(stripped)
        if normalised is not None:
            urls.append(normalised)
    return urls


def collect_curated(settings: Settings, day: date) -> pd.DataFrame:
    """Write unseen curated benign URLs as `data/raw/benign_<day>.parquet`."""
    already_seen = seen_urls(settings)
    fresh: list[str] = []
    new_seen: set[str] = set()
    for url in load_curated():
        if url in already_seen or url in new_seen:
            continue
        new_seen.add(url)
        fresh.append(url)

    frame = pd.DataFrame(
        {
            "url": fresh,
            "source": SOURCE,
            "label": LABEL_BENIGN,
            "first_seen": day.isoformat(),
        },
        columns=RAW_PHISHING_COLUMNS,
    )

    path = raw_benign_path(settings, day)
    if fresh:
        existing = pd.read_parquet(path) if path.exists() else frame.iloc[0:0]
        combined = pd.concat([existing, frame], ignore_index=True)
        combined = combined.drop_duplicates(subset=["url"], keep="first")
        write_parquet(combined, path)

    return frame

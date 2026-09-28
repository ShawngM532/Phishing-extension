"""Parquet/HTML storage helpers for the collection pipeline.

The collection store is append-only and lives under `data/` (gitignored):

  data/raw/openphish_<YYYY-MM-DD>.parquet   URLs discovered that day
  data/crawled/crawl_<YYYY-MM-DD>.parquet   crawl results + HTML references
  data/html/<sha256>.html                   raw page HTML

`first_seen` is the earliest daily raw file a URL appears in.
"""

from __future__ import annotations

import hashlib
from datetime import date, datetime
from pathlib import Path

import pandas as pd

from settings import Settings

RAW_PHISHING_COLUMNS = ["url", "source", "label", "first_seen"]
CRAWLED_COLUMNS = [
    "url",
    "final_url",
    "status",
    "html_file",
    "html_sha256",
    "bytes",
    "fetched_at",
    "error",
    "source",
    "label",
]


def ensure_dirs(settings: Settings) -> None:
    for relative in (
        settings.paths.data_dir,
        settings.paths.raw_dir,
        settings.paths.crawled_dir,
        settings.paths.html_dir,
    ):
        settings.resolve(relative).mkdir(parents=True, exist_ok=True)


def raw_phishing_path(settings: Settings, day: date) -> Path:
    return settings.resolve(settings.paths.raw_dir) / f"openphish_{day.isoformat()}.parquet"


def raw_benign_path(settings: Settings, day: date) -> Path:
    return settings.resolve(settings.paths.raw_dir) / f"benign_{day.isoformat()}.parquet"


def crawled_path(settings: Settings, day: date) -> Path:
    return settings.resolve(settings.paths.crawled_dir) / f"crawl_{day.isoformat()}.parquet"


def crawled_snapshot_path(settings: Settings, when: datetime) -> Path:
    stamp = when.strftime("%Y-%m-%dT%H%M%S")
    return settings.resolve(settings.paths.crawled_dir) / f"crawl_{stamp}.parquet"


def html_dir(settings: Settings) -> Path:
    return settings.resolve(settings.paths.html_dir)


def read_parquet_glob(
    directory: Path, pattern: str, columns: list[str] | None = None
) -> pd.DataFrame:
    """Concatenate every parquet file matching `pattern`, tolerating an empty store."""
    files = sorted(directory.glob(pattern)) if directory.exists() else []
    if not files:
        return pd.DataFrame(columns=columns or [])

    frames = [pd.read_parquet(path) for path in files]
    combined = pd.concat(frames, ignore_index=True)
    if columns is not None:
        for column in columns:
            if column not in combined.columns:
                combined[column] = pd.NA
        combined = combined[columns]
    return combined


def read_raw_phishing(settings: Settings) -> pd.DataFrame:
    return read_parquet_glob(
        settings.resolve(settings.paths.raw_dir), "openphish_*.parquet", RAW_PHISHING_COLUMNS
    )


def read_raw_benign(settings: Settings) -> pd.DataFrame:
    return read_parquet_glob(
        settings.resolve(settings.paths.raw_dir), "benign_*.parquet", RAW_PHISHING_COLUMNS
    )


def read_crawled(settings: Settings) -> pd.DataFrame:
    return read_parquet_glob(
        settings.resolve(settings.paths.crawled_dir), "*.parquet", CRAWLED_COLUMNS
    )


def seen_urls(settings: Settings) -> set[str]:
    phishing = read_raw_phishing(settings)
    benign = read_raw_benign(settings)
    urls = set(phishing["url"].dropna().astype(str))
    urls.update(benign["url"].dropna().astype(str))
    return urls


def crawled_urls(settings: Settings) -> set[str]:
    frame = read_crawled(settings)
    return set(frame["url"].dropna().astype(str))


def write_parquet(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_parquet(path, index=False)


def store_html(
    settings: Settings, url: str, content: bytes, max_bytes: int
) -> tuple[str, str, int]:
    """Persist page HTML by content hash. Returns (relative_path, sha256, stored_bytes)."""
    truncated = content[:max_bytes]
    digest = hashlib.sha256(truncated).hexdigest()
    target = html_dir(settings) / f"{digest}.html"
    if not target.exists():
        target.write_bytes(truncated)
    relative = target.relative_to(settings.resolve(settings.paths.data_dir)).as_posix()
    return relative, digest, len(truncated)


def url_digest(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()

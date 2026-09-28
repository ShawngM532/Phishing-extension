"""Collect phishing URLs from the key-free OpenPhish community feed."""

from __future__ import annotations

from datetime import date
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen

import pandas as pd

from settings import Settings
from storage import RAW_PHISHING_COLUMNS, raw_phishing_path, seen_urls, write_parquet

SOURCE = "openphish"
LABEL_PHISHING = 1


def normalise_url(raw: str) -> str | None:
    """Return a canonical http(s) URL, or None if it is not crawlable."""
    candidate = raw.strip()
    if candidate == "":
        return None

    parts = urlsplit(candidate)
    if parts.scheme.lower() not in {"http", "https"}:
        return None
    if not parts.netloc:
        return None

    host = parts.hostname
    if host is None or host == "":
        return None

    netloc = host.lower()
    if parts.port is not None and not (
        (parts.scheme.lower() == "http" and parts.port == 80)
        or (parts.scheme.lower() == "https" and parts.port == 443)
    ):
        netloc = f"{netloc}:{parts.port}"

    return urlunsplit((parts.scheme.lower(), netloc, parts.path or "/", parts.query, ""))


def parse_feed(text: str, limit: int) -> list[str]:
    urls: list[str] = []
    for line in text.splitlines():
        normalised = normalise_url(line)
        if normalised is None:
            continue
        urls.append(normalised)
        if len(urls) >= limit:
            break
    return urls


def fetch_feed(settings: Settings) -> str:
    request = Request(
        settings.openphish.url,
        headers={
            "User-Agent": settings.crawl.user_agent,
            "Accept": "text/plain,*/*",
        },
    )
    with urlopen(request, timeout=settings.openphish.timeout_seconds) as response:
        return response.read().decode("utf-8", errors="replace")


def collect_openphish(settings: Settings, day: date) -> pd.DataFrame:
    """Fetch the feed and write the URLs not seen before as `data/raw/openphish_<day>.parquet`.

    Returns only the newly discovered rows (label=1, first_seen=day).
    """
    already_seen = seen_urls(settings)
    discovered = parse_feed(fetch_feed(settings), settings.openphish.max_urls)

    fresh: list[str] = []
    new_seen: set[str] = set()
    for url in discovered:
        if url in already_seen or url in new_seen:
            continue
        new_seen.add(url)
        fresh.append(url)

    frame = pd.DataFrame(
        {
            "url": fresh,
            "source": SOURCE,
            "label": LABEL_PHISHING,
            "first_seen": day.isoformat(),
        },
        columns=RAW_PHISHING_COLUMNS,
    )

    path = raw_phishing_path(settings, day)
    if fresh:
        # Merge with anything already discovered for the same day so re-running the
        # collector never loses rows.
        existing = pd.read_parquet(path) if path.exists() else frame.iloc[0:0]
        combined = pd.concat([existing, frame], ignore_index=True)
        combined = combined.drop_duplicates(subset=["url"], keep="first")
        write_parquet(combined, path)

    return frame

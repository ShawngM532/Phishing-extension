from __future__ import annotations

from datetime import date
from pathlib import Path

import pandas as pd

from storage import (
    RAW_PHISHING_COLUMNS,
    ensure_dirs,
    raw_phishing_path,
    read_raw_phishing,
    store_html,
    url_digest,
    write_parquet,
)


def test_read_empty_store(settings) -> None:
    frame = read_raw_phishing(settings)
    assert frame.empty
    assert list(frame.columns) == RAW_PHISHING_COLUMNS


def test_write_read_roundtrip(settings) -> None:
    ensure_dirs(settings)
    source = pd.DataFrame(
        {
            "url": ["http://a.test/", "http://b.test/"],
            "source": ["openphish", "openphish"],
            "label": [1, 1],
            "first_seen": ["2026-01-01", "2026-01-01"],
        },
        columns=RAW_PHISHING_COLUMNS,
    )
    write_parquet(source, raw_phishing_path(settings, date(2026, 1, 1)))

    stored = read_raw_phishing(settings)
    assert sorted(stored["url"]) == ["http://a.test/", "http://b.test/"]


def test_store_html_deduplicates_by_content(settings) -> None:
    ensure_dirs(settings)
    payload = b"<html>" + b"x" * 1000

    rel1, digest1, size1 = store_html(settings, "http://a.test/", payload, max_bytes=10_000)
    rel2, digest2, size2 = store_html(settings, "http://a.test/", payload, max_bytes=10_000)

    assert (rel1, digest1, size1) == (rel2, digest2, size2)
    assert size1 == len(payload)
    assert (settings.resolve(settings.paths.data_dir) / rel1).exists()


def test_store_html_caps_size(settings) -> None:
    ensure_dirs(settings)
    _, _, size = store_html(settings, "http://b.test/", b"y" * 5000, max_bytes=1000)
    assert size == 1000


def test_url_digest_is_stable() -> None:
    assert url_digest("http://a.test/") == url_digest("http://a.test/")
    assert len(url_digest("http://a.test/")) == 64


def test_html_stored_relative_to_data_dir(settings) -> None:
    ensure_dirs(settings)
    rel, _, _ = store_html(settings, "http://c.test/", b"<html>ok</html>", max_bytes=1000)
    assert Path(rel).parts[0] == "html"

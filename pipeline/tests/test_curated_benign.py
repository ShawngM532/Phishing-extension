from __future__ import annotations

from datetime import date
from pathlib import Path

from collect import curated_benign
from storage import read_raw_benign, read_raw_phishing, seen_urls


def test_normalise_url() -> None:
    assert curated_benign.normalise_url("https://Example.COM/Login") == "https://example.com/Login"
    assert curated_benign.normalise_url("https://a.test") == "https://a.test/"
    assert curated_benign.normalise_url("ftp://a.test") is None
    assert curated_benign.normalise_url("not a url") is None


def test_load_curated_skips_comments_and_blanks(tmp_path: Path) -> None:
    listing = tmp_path / "list.txt"
    listing.write_text(
        "# a comment\nhttps://a.test/login\n\nnotaurl\nhttps://b.test/\n", encoding="utf-8"
    )
    assert curated_benign.load_curated(listing) == ["https://a.test/login", "https://b.test/"]


def test_collect_is_idempotent_and_labeled_benign(settings, monkeypatch) -> None:
    monkeypatch.setattr(
        curated_benign,
        "load_curated",
        lambda _path=curated_benign.CURATED_FILE: ["https://a.test/", "https://b.test/"],
    )

    day = date(2026, 1, 1)
    first = curated_benign.collect_curated(settings, day)
    assert sorted(first["url"]) == ["https://a.test/", "https://b.test/"]
    assert set(first["label"]) == {0}
    assert set(first["source"]) == {"curated"}

    again = curated_benign.collect_curated(settings, day)
    assert again.empty
    assert len(read_raw_benign(settings)) == 2


def test_raw_readers_are_separated(settings, monkeypatch) -> None:
    monkeypatch.setattr(
        curated_benign,
        "load_curated",
        lambda _path=curated_benign.CURATED_FILE: ["https://benign.test/"],
    )
    curated_benign.collect_curated(settings, date(2026, 1, 1))

    assert read_raw_phishing(settings).empty
    assert len(read_raw_benign(settings)) == 1
    assert seen_urls(settings) == {"https://benign.test/"}

from __future__ import annotations

from datetime import date

import pytest

from collect import openphish
from storage import read_raw_phishing


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("http://Example.COM/Path?x=1#frag", "http://example.com/Path?x=1"),
        ("https://evil.test:8443/a", "https://evil.test:8443/a"),
        ("http://evil.test:80/a", "http://evil.test/a"),
        ("https://evil.test:443/a", "https://evil.test/a"),
        ("  https://evil.test/login  ", "https://evil.test/login"),
        ("ftp://evil.test/a", None),
        ("javascript:alert(1)", None),
        ("not a url", None),
        ("", None),
        ("http://", None),
    ],
)
def test_normalise_url(raw: str, expected: str | None) -> None:
    assert openphish.normalise_url(raw) == expected


def test_parse_feed_skips_invalid_and_respects_limit() -> None:
    text = "\n".join(["http://a.test/", "", "nonsense", "http://b.test/", "http://c.test/"])
    assert openphish.parse_feed(text, limit=10) == [
        "http://a.test/",
        "http://b.test/",
        "http://c.test/",
    ]
    assert openphish.parse_feed(text, limit=2) == ["http://a.test/", "http://b.test/"]


def test_collect_writes_and_deduplicates(settings, monkeypatch: pytest.MonkeyPatch) -> None:
    feed = "http://a.test/x\nhttp://b.test/y\nhttp://a.test/x\n"
    monkeypatch.setattr(openphish, "fetch_feed", lambda _settings: feed)

    day = date(2026, 1, 1)
    first = openphish.collect_openphish(settings, day)
    assert sorted(first["url"]) == ["http://a.test/x", "http://b.test/y"]
    assert set(first["label"]) == {1}
    assert set(first["first_seen"]) == {"2026-01-01"}

    stored = read_raw_phishing(settings)
    assert len(stored) == 2

    # Re-running the same day adds nothing new.
    again = openphish.collect_openphish(settings, day)
    assert again.empty
    assert len(read_raw_phishing(settings)) == 2


def test_first_seen_is_earliest_day(settings, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(openphish, "fetch_feed", lambda _settings: "http://a.test/\n")
    openphish.collect_openphish(settings, date(2026, 1, 1))

    monkeypatch.setattr(openphish, "fetch_feed", lambda _settings: "http://a.test/\nhttp://b.test/\n")
    second = openphish.collect_openphish(settings, date(2026, 1, 2))

    assert list(second["url"]) == ["http://b.test/"]
    stored = read_raw_phishing(settings)
    earliest = dict(zip(stored["url"], stored["first_seen"], strict=True))
    assert earliest["http://a.test/"] == "2026-01-01"
    assert earliest["http://b.test/"] == "2026-01-02"

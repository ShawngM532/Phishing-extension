from __future__ import annotations

import pandas as pd
import pytest

from crawl import filter as crawl_filter
from storage import CRAWLED_COLUMNS


def _row(**overrides) -> dict:
    base = {
        "url": "http://phish.test/login",
        "final_url": "http://phish.test/login",
        "status": 200,
        "html_file": "html/abc.html",
        "html_sha256": "abc",
        "bytes": 2000,
        "fetched_at": "2026-01-01T00:00:00Z",
        "error": None,
        "source": "openphish",
        "label": 1,
    }
    base.update(overrides)
    return base


def _frame(rows: list[dict]) -> pd.DataFrame:
    return pd.DataFrame(rows, columns=CRAWLED_COLUMNS)


def test_keeps_a_healthy_page() -> None:
    frame = _frame([_row()])
    kept, dropped = crawl_filter.filter_crawl(frame, html_loader=lambda _p: "<html>login</html>")
    assert len(kept) == 1
    assert dropped == {}


@pytest.mark.parametrize(
    ("overrides", "reason"),
    [
        ({"error": "TimeoutError: boom"}, "error"),
        ({"status": 404}, "status"),
        ({"bytes": 10}, "too_small"),
        ({"html_file": None}, "too_small"),
    ],
)
def test_drops_bad_rows(overrides: dict, reason: str) -> None:
    frame = _frame([_row(**overrides)])
    kept, dropped = crawl_filter.filter_crawl(frame, html_loader=lambda _p: "<html>x</html>")
    assert kept.empty
    assert dropped == {reason: 1}


def test_drops_parked_domains() -> None:
    frame = _frame([_row()])
    kept, dropped = crawl_filter.filter_crawl(
        frame, html_loader=lambda _p: "<html>This domain is for sale. Buy this domain.</html>"
    )
    assert kept.empty
    assert dropped == {"parked": 1}


def test_is_parked_matches_known_markers() -> None:
    assert crawl_filter.is_parked("<h1>domain is parked</h1>")
    assert crawl_filter.is_parked("Visit sedoparking.com")
    assert not crawl_filter.is_parked("<html>normal login page</html>")


def test_legit_redirect_rule_is_optional() -> None:
    frame = _frame([_row(final_url="https://xero.com/")])

    kept, _ = crawl_filter.filter_crawl(frame, html_loader=lambda _p: "<html>x</html>")
    assert len(kept) == 1

    kept2, dropped2 = crawl_filter.filter_crawl(
        frame,
        html_loader=lambda _p: "<html>x</html>",
        is_legit_redirect=lambda _url, final: final.startswith("https://xero.com"),
    )
    assert kept2.empty
    assert dropped2 == {"legit_redirect": 1}


def test_empty_frame_is_handled() -> None:
    kept, dropped = crawl_filter.filter_crawl(_frame([]), html_loader=lambda _p: "")
    assert kept.empty
    assert dropped == {}

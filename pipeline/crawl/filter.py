"""Filter crawl results down to usable pages (PRD §6.7).

Drops non-200s, tiny pages, parked/for-sale domains, and (optionally) pages that
redirected to a known-legitimate domain — a phishing URL that now resolves to the
real brand is a dead phish.
"""

from __future__ import annotations

import re
from collections import Counter
from collections.abc import Callable

import pandas as pd

MIN_HTML_BYTES = 500

PARKED_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"this domain is for sale",
        r"buy this domain",
        r"domain (?:is )?parked",
        r"parked (?:free )?(?:by|at)",
        r"sedoparking",
        r"afternic",
        r"hugedomains",
        r"dan\.com",
        r"domain(?:s)? for sale",
        r"the owner of this domain",
        r"godaddy\.com/domainsearch",
    )
]


def is_parked(html: str) -> bool:
    return any(pattern.search(html) for pattern in PARKED_PATTERNS)


def filter_crawl(
    frame: pd.DataFrame,
    html_loader: Callable[[str], str],
    is_legit_redirect: Callable[[str, str], bool] | None = None,
) -> tuple[pd.DataFrame, dict[str, int]]:
    """Return (kept_rows, drop_reason_counts).

    `html_loader` maps the stored `html_file` path to text. `is_legit_redirect`
    receives (input_url, final_url) and returns True when the redirect target is a
    known-legitimate domain; pass None to disable that rule.
    """
    if frame.empty:
        return frame.copy(), {}

    dropped: Counter[str] = Counter()
    keep_mask: list[bool] = []

    for row in frame.to_dict("records"):
        error = row.get("error")
        status = row.get("status")
        byte_count = row.get("bytes") or 0
        html_file = row.get("html_file")

        if error not in (None, "") and pd.notna(error):
            dropped["error"] += 1
            keep_mask.append(False)
            continue
        if status != 200:
            dropped["status"] += 1
            keep_mask.append(False)
            continue
        if byte_count < MIN_HTML_BYTES or not html_file:
            dropped["too_small"] += 1
            keep_mask.append(False)
            continue

        html = html_loader(str(html_file))
        if is_parked(html):
            dropped["parked"] += 1
            keep_mask.append(False)
            continue
        if (
            is_legit_redirect is not None
            and str(row.get("final_url")) != str(row.get("url"))
            and is_legit_redirect(str(row.get("url")), str(row.get("final_url")))
        ):
            dropped["legit_redirect"] += 1
            keep_mask.append(False)
            continue

        keep_mask.append(True)

    kept = frame.loc[keep_mask].reset_index(drop=True)
    return kept, dict(dropped)

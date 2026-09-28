"""Idempotent collection driver.

Run it on a schedule (every 6h). Each invocation discovers new OpenPhish URLs,
assigns `first_seen = today` to the ones never seen before, and crawls any
uncrawled URL. Safe to re-run: already-seen URLs are not re-dated and already-
crawled URLs are not re-fetched.

Usage:
  uv run python run_collection.py            # collect + crawl
  uv run python run_collection.py --collect  # discovery only
  uv run python run_collection.py --crawl    # crawl pending only
"""

from __future__ import annotations

import argparse
from datetime import date

from collect.openphish import collect_openphish
from crawl.fetch import crawl_pending_phishing
from settings import load_settings
from storage import ensure_dirs


def main() -> None:
    parser = argparse.ArgumentParser(description="Sentinel collection driver")
    parser.add_argument("--collect", action="store_true", help="only pull feeds")
    parser.add_argument("--crawl", action="store_true", help="only crawl pending URLs")
    parser.add_argument("--limit", type=int, default=None, help="cap URLs crawled this run")
    args = parser.parse_args()

    collect = args.collect or not args.crawl
    crawl = args.crawl or not args.collect

    settings = load_settings()
    ensure_dirs(settings)
    day = date.today()

    if collect:
        fresh = collect_openphish(settings, day)
        print(f"[collect] {len(fresh)} new phishing URL(s) first seen {day.isoformat()}")

    if crawl:
        crawled = crawl_pending_phishing(settings, limit=args.limit)
        ok = int((crawled.get("status") == 200).sum()) if not crawled.empty else 0
        print(f"[crawl] {len(crawled)} URL(s) fetched, {ok} with HTTP 200")


if __name__ == "__main__":
    main()

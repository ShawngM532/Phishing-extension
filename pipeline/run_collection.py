"""Idempotent collection driver.

Run it on a schedule (every 6h). Each invocation discovers new OpenPhish phishing
URLs and the curated benign list, assigns `first_seen = today` to URLs never seen
before, and crawls any uncrawled URL. Safe to re-run: already-seen URLs are not
re-dated and already-crawled URLs are not re-fetched.

Usage:
  uv run python run_collection.py              # collect + crawl phishing and benign
  uv run python run_collection.py --collect    # discovery only
  uv run python run_collection.py --crawl      # crawl pending only
  uv run python run_collection.py --benign     # curated benign only
  uv run python run_collection.py --crawl --limit 20
"""

from __future__ import annotations

import argparse
from datetime import date

from collect.curated_benign import collect_curated
from collect.openphish import collect_openphish
from crawl.fetch import crawl_pending_benign, crawl_pending_phishing
from settings import load_settings
from storage import ensure_dirs


def _report_crawl(label: str, crawled) -> None:
    if crawled.empty:
        print(f"[crawl] {label}: nothing pending")
        return
    ok = int((crawled.get("status") == 200).sum())
    print(f"[crawl] {label}: {len(crawled)} fetched, {ok} with HTTP 200")


def main() -> None:
    parser = argparse.ArgumentParser(description="Sentinel collection driver")
    parser.add_argument("--collect", action="store_true", help="only pull feeds")
    parser.add_argument("--crawl", action="store_true", help="only crawl pending URLs")
    parser.add_argument("--benign", action="store_true", help="only curated benign URLs")
    parser.add_argument("--limit", type=int, default=None, help="cap URLs crawled per source")
    args = parser.parse_args()

    do_collect = args.collect or not args.crawl
    do_crawl = args.crawl or not args.collect

    settings = load_settings()
    ensure_dirs(settings)
    day = date.today()

    if args.benign:
        if do_collect:
            fresh = collect_curated(settings, day)
            print(f"[collect] benign: {len(fresh)} new URL(s) first seen {day.isoformat()}")
        if do_crawl:
            _report_crawl("benign", crawl_pending_benign(settings, limit=args.limit))
        return

    if do_collect:
        phishing = collect_openphish(settings, day)
        benign = collect_curated(settings, day)
        print(
            f"[collect] phishing: {len(phishing)} new, benign: {len(benign)} new "
            f"(first seen {day.isoformat()})"
        )

    if do_crawl:
        _report_crawl("phishing", crawl_pending_phishing(settings, limit=args.limit))
        _report_crawl("benign", crawl_pending_benign(settings, limit=args.limit))


if __name__ == "__main__":
    main()

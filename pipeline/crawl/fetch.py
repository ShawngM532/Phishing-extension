"""Crawl URLs to disk with headless Chromium (Playwright, async).

Design goals:
- never crash a multi-hour run because one page misbehaved;
- stay polite (bounded concurrency, media/fonts blocked, request timeout);
- capture what feature extraction actually needs: final URL, status, HTML.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime

import pandas as pd
from playwright.async_api import Route, async_playwright

from settings import Settings
from storage import (
    CRAWLED_COLUMNS,
    crawled_snapshot_path,
    crawled_urls,
    ensure_dirs,
    read_raw_benign,
    read_raw_phishing,
    store_html,
    write_parquet,
)

SOURCE = "openphish"
LABEL_PHISHING = 1
BENIGN_SOURCE = "curated"
LABEL_BENIGN = 0


def _empty_frame() -> pd.DataFrame:
    return pd.DataFrame(columns=CRAWLED_COLUMNS)


def _record(url: str, source: str, label: int) -> dict:
    return {
        "url": url,
        "final_url": url,
        "status": 0,
        "html_file": None,
        "html_sha256": None,
        "bytes": 0,
        "fetched_at": datetime.now(UTC).isoformat(),
        "error": None,
        "source": source,
        "label": label,
    }


async def _fetch_one(
    settings: Settings,
    context,
    semaphore: asyncio.Semaphore,
    url: str,
    source: str,
    label: int,
) -> dict:
    record = _record(url, source, label)
    attempts = settings.crawl.retries + 1

    for attempt in range(attempts):
        async with semaphore:
            page = await context.new_page()
            try:
                response = await page.goto(
                    url,
                    timeout=settings.crawl.timeout_seconds * 1000,
                    wait_until="domcontentloaded",
                )
                record["status"] = response.status if response is not None else 0
                record["final_url"] = page.url
                html = await page.content()
                content = html.encode("utf-8", errors="replace")
                relative, digest, size = store_html(
                    settings, url, content, settings.crawl.max_html_bytes
                )
                record["html_file"] = relative
                record["html_sha256"] = digest
                record["bytes"] = size
                record["error"] = None
                record["fetched_at"] = datetime.now(UTC).isoformat()
                return record
            except Exception as exc:  # noqa: BLE001 - a crawl run must never abort on one URL
                record["error"] = f"{type(exc).__name__}: {str(exc)[:200]}"
                record["fetched_at"] = datetime.now(UTC).isoformat()
            finally:
                await page.close()
        if attempt < attempts - 1:
            await asyncio.sleep(1.0)

    return record


async def _crawl_async(
    settings: Settings,
    urls: list[str],
    source: str,
    label: int,
    blocked_types: set[str],
) -> list[dict]:
    semaphore = asyncio.Semaphore(settings.crawl.concurrency)

    async def handler(route: Route) -> None:
        if route.request.resource_type in blocked_types:
            await route.abort()
        else:
            await route.continue_()

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=settings.crawl.headless)
        context = await browser.new_context(user_agent=settings.crawl.user_agent)
        await context.route("**/*", handler)
        try:
            tasks = [
                asyncio.create_task(_fetch_one(settings, context, semaphore, url, source, label))
                for url in urls
            ]
            return await asyncio.gather(*tasks)
        finally:
            await context.close()
            await browser.close()


def crawl_urls(settings: Settings, urls: list[str], source: str, label: int) -> pd.DataFrame:
    if not urls:
        return _empty_frame()
    blocked = set(settings.crawl.block_resource_types)
    records = asyncio.run(_crawl_async(settings, list(urls), source, label, blocked))
    return pd.DataFrame(records, columns=CRAWLED_COLUMNS)


def _crawl_pending(
    settings: Settings,
    reader,
    source: str,
    label: int,
    when: datetime | None,
    limit: int | None,
) -> pd.DataFrame:
    ensure_dirs(settings)
    raw = reader(settings)
    done = crawled_urls(settings)

    seen: set[str] = set()
    pending: list[str] = []
    for url in raw["url"].dropna().astype(str).tolist():
        if url in done or url in seen:
            continue
        seen.add(url)
        pending.append(url)

    if limit is not None:
        pending = pending[:limit]

    if not pending:
        return _empty_frame()

    frame = crawl_urls(settings, pending, source, label)
    write_parquet(frame, crawled_snapshot_path(settings, when or datetime.now(UTC)))
    return frame


def crawl_pending_phishing(
    settings: Settings, when: datetime | None = None, limit: int | None = None
) -> pd.DataFrame:
    """Crawl raw phishing URLs not yet crawled, write a timestamped parquet."""
    return _crawl_pending(settings, read_raw_phishing, SOURCE, LABEL_PHISHING, when, limit)


def crawl_pending_benign(
    settings: Settings, when: datetime | None = None, limit: int | None = None
) -> pd.DataFrame:
    """Crawl curated benign URLs not yet crawled, write a timestamped parquet."""
    return _crawl_pending(settings, read_raw_benign, BENIGN_SOURCE, LABEL_BENIGN, when, limit)

"""Check curated URLs for reachability and rewrite the list with the reachable subset.

A URL counts as reachable if it returns any HTTP status < 500 (403/405 from bot
protection still means the page exists). Connection/DNS/TLS failures are dropped.

Usage:
  uv run python collect/verify_urls.py                 # filter curated_benign.txt in place
  uv run python collect/verify_urls.py --dry-run       # report only
"""

from __future__ import annotations

import argparse
import ssl
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
)
DEFAULT_FILE = Path(__file__).with_name("curated_benign.txt")


def check(url: str, timeout: float) -> tuple[str, int | None]:
    try:
        request = Request(
            url,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"},
            method="GET",
        )
        with urlopen(request, timeout=timeout, context=ssl.create_default_context()) as response:
            return url, int(response.status)
    except HTTPError as error:
        return url, int(error.code)
    except Exception:  # noqa: BLE001 - any failure means "not reachable"
        return url, None


def is_reachable(status: int | None) -> bool:
    return status is not None and status < 500


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify curated URL reachability")
    parser.add_argument("--input", type=Path, default=DEFAULT_FILE)
    parser.add_argument("--output", type=Path, default=DEFAULT_FILE)
    parser.add_argument("--timeout", type=float, default=12.0)
    parser.add_argument("--workers", type=int, default=16)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    lines = args.input.read_text(encoding="utf-8").splitlines()
    urls = [line.strip() for line in lines if line.strip() and not line.strip().startswith("#")]

    statuses: dict[str, int | None] = {}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for url, status in pool.map(lambda u: check(u, args.timeout), urls):
            statuses[url] = status

    reachable = [url for url in urls if is_reachable(statuses.get(url))]
    unreachable = [url for url in urls if not is_reachable(statuses.get(url))]

    print(f"[verify] {len(reachable)}/{len(urls)} reachable")
    for url in unreachable:
        print(f"[verify] dropped {url} (status={statuses.get(url)})")

    if args.dry_run:
        return

    output_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped == "" or stripped.startswith("#") or is_reachable(statuses.get(stripped)):
            output_lines.append(line)

    args.output.write_text("\n".join(output_lines) + "\n", encoding="utf-8")
    print(f"[verify] wrote {len(reachable)} URLs to {args.output}")


if __name__ == "__main__":
    main()

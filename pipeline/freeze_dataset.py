"""Freeze the collection store: hash every artifact and write docs/DATASET.md.

The full store lives under `pipeline/data/` (gitignored). Only a small synthetic
fixture subset is committed. Reproducibility therefore relies on the SHA-256 hashes
recorded here plus the collector scripts.

Usage:
  uv run python freeze_dataset.py
"""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path

from settings import load_settings
from storage import read_crawled, read_raw_benign, read_raw_phishing

PIPELINE_ROOT = Path(__file__).resolve().parent
REPO_ROOT = PIPELINE_ROOT.parent
DOCS = REPO_ROOT / "docs"
MANIFEST = PIPELINE_ROOT / "data" / "MANIFEST.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def collect_hashes(settings) -> list[dict]:
    entries: list[dict] = []
    directories = (
        settings.resolve(settings.paths.raw_dir),
        settings.resolve(settings.paths.crawled_dir),
    )
    for directory in directories:
        if not directory.exists():
            continue
        for path in sorted(directory.glob("*.parquet")):
            relative = path.relative_to(settings.resolve(settings.paths.data_dir)).as_posix()
            entries.append(
                {
                    "path": relative,
                    "sha256": sha256_file(path),
                    "bytes": path.stat().st_size,
                }
            )
    return entries


def main() -> None:
    settings = load_settings()
    phishing = read_raw_phishing(settings)
    benign = read_raw_benign(settings)
    crawled = read_crawled(settings)

    first_seen = sorted(
        set(phishing["first_seen"].dropna().astype(str))
        | set(benign["first_seen"].dropna().astype(str))
    )

    hashes = collect_hashes(settings)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    manifest = {"generated": datetime.now(UTC).isoformat(), "artifacts": hashes}
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    lines: list[str] = []
    lines.append("# Dataset")
    lines.append("")
    lines.append(f"Frozen {datetime.now(UTC).isoformat(timespec='seconds')}.")
    lines.append("")
    lines.append("## Collection store (local, gitignored)")
    lines.append("")
    lines.append(f"- Phishing URLs discovered: **{len(phishing)}**")
    lines.append(f"- Curated benign URLs: **{len(benign)}**")
    lines.append(f"- Crawl results: **{len(crawled)}**")
    lines.append(f"- `first_seen` dates: {', '.join(first_seen) if first_seen else 'none'}")
    lines.append("")
    lines.append("Layout: `data/raw/` (feed URLs), `data/crawled/` (crawl metadata),")
    lines.append("`data/html/` (content-addressed HTML). See `docs/COLLECTION.md`.")
    lines.append("")
    lines.append("## Artifact hashes")
    lines.append("")
    if hashes:
        lines.append("| Path | SHA-256 | Bytes |")
        lines.append("| --- | --- | --- |")
        for entry in hashes:
            lines.append(f"| `{entry['path']}` | `{entry['sha256']}` | {entry['bytes']} |")
    else:
        lines.append("_No artifacts yet._")
    lines.append("")
    lines.append("## Committed fixture subset")
    lines.append("")
    lines.append(
        "The repository commits only synthetic, safe fixtures for CI reproducibility: "
        "the 25-page verdict corpus under `fixtures/pages/corpus/` plus the golden DOM "
        "fixtures. Real crawled phishing HTML is **not** committed (it is malicious "
        "content and large); it stays in the local store and is identified by the "
        "hashes above."
    )
    lines.append("")
    lines.append("## Splits")
    lines.append("")
    lines.append(
        "Not yet frozen. A real temporal split (`train < T`, `val [T, T+14d)`, "
        "`test [T+14d, T+28d)`) requires the collector to run for ~6 weeks so that "
        "`first_seen` spans the cutoffs. See `docs/COLLECTION.md`."
    )
    lines.append("")

    DOCS.mkdir(parents=True, exist_ok=True)
    (DOCS / "DATASET.md").write_text("\n".join(lines), encoding="utf-8")
    print(
        f"[freeze] phishing={len(phishing)} benign={len(benign)} crawled={len(crawled)} "
        f"artifacts={len(hashes)} -> docs/DATASET.md"
    )


if __name__ == "__main__":
    main()

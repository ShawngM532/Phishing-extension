"""Build the bundled Tranco top-50k Bloom filter.

Downloads the Tranco top-1M list, reduces it to unique eTLD+1 registrable domains,
builds a Bloom filter sized for a 1% false-positive rate, and writes:

  apps/extension/public/tranco.bloom     binary filter (see FORMAT below)
  apps/extension/public/tranco.meta.json metadata (date, list id, m, k, seed)

Binary format (little-endian):

  magic          4 bytes  "TBLM"
  format_version u16
  m              u32      number of bits
  k              u8       number of hash functions
  hash_seed      u32      FNV-1a seed
  bits           ceil(m/8) bytes, LSB-first within each byte

Usage:
  uv run python build_bloom.py --top 50000 --out ../apps/extension/public
  uv run python build_bloom.py --input tranco.csv --top 50000 --out ../apps/extension/public
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import struct
import urllib.request
from datetime import date
from pathlib import Path

import tldextract

MAGIC = b"TBLM"
FORMAT_VERSION = 1
DEFAULT_SEED = 0x811C9DC5
FNV_PRIME = 0x01000193
FNV_OFFSET = 0x811C9DC5

_TRANCO_LATEST = "https://tranco-list.eu/api/lists/date/latest"
_TRANCO_DOWNLOAD = "https://tranco-list.eu/download/{list_id}/{count}"

_extractor = tldextract.TLDExtract(suffix_list_urls=())


def fnv1a(data: bytes, seed: int = FNV_OFFSET) -> int:
    h = seed & 0xFFFFFFFF
    for byte in data:
        h ^= byte
        h = (h * FNV_PRIME) & 0xFFFFFFFF
    return h


def optimal_m(n: int, p: float) -> int:
    return max(1, int(math.ceil(-(n * math.log(p)) / (math.log(2) ** 2))))


def optimal_k(m: int, n: int) -> int:
    return max(1, int(round((m / n) * math.log(2))))


def add(bits: bytearray, m: int, k: int, seed: int, value: str) -> None:
    data = value.encode("utf-8")
    h1 = fnv1a(data, seed)
    h2 = fnv1a(data, seed ^ 0x9E3779B9) | 1
    for i in range(k):
        index = (h1 + i * h2) % m
        bits[index >> 3] |= 1 << (index & 7)


def contains(bits: bytes, m: int, k: int, seed: int, value: str) -> bool:
    data = value.encode("utf-8")
    h1 = fnv1a(data, seed)
    h2 = fnv1a(data, seed ^ 0x9E3779B9) | 1
    for i in range(k):
        index = (h1 + i * h2) % m
        if not (bits[index >> 3] & (1 << (index & 7))):
            return False
    return True


def build_filter(items: list[str], *, false_positive_rate: float = 0.01, seed: int = DEFAULT_SEED):
    n = max(1, len(items))
    m = optimal_m(n, false_positive_rate)
    k = optimal_k(m, n)
    bits = bytearray((m + 7) // 8)
    for item in items:
        add(bits, m, k, seed, item)
    return m, k, seed, bytes(bits)


def serialize(m: int, k: int, seed: int, bits: bytes) -> bytes:
    header = MAGIC + struct.pack("<HIBI", FORMAT_VERSION, m, k, seed)
    return header + bits


def parse_header(data: bytes) -> tuple[int, int, int]:
    if data[:4] != MAGIC:
        raise ValueError("bad magic")
    version, m, k, seed = struct.unpack_from("<HIBI", data, 4)
    if version != FORMAT_VERSION:
        raise ValueError(f"unsupported format version {version}")
    return m, k, seed


def registered_domain(host: str) -> str | None:
    result = _extractor(host)
    if result.domain and result.suffix:
        return f"{result.domain}.{result.suffix}"
    return None


def read_tranco(path: Path, count: int) -> list[str]:
    domains: list[str] = []
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle)
        for row in reader:
            if not row:
                continue
            if len(row) >= 2 and row[0].isdigit():
                host = row[1]
            else:
                host = row[0]
            etld1 = registered_domain(host)
            if etld1 is not None:
                domains.append(etld1)
            if len(domains) >= count:
                break
    return domains


def fetch_latest_list_id() -> str:
    with urllib.request.urlopen(_TRANCO_LATEST, timeout=30) as response:
        payload = json.load(response)
    return str(payload["list_id"])


def download_tranco(list_id: str, count: int, destination: Path) -> Path:
    url = _TRANCO_DOWNLOAD.format(list_id=list_id, count=count)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=120) as response:
        destination.write_bytes(response.read())
    return destination


def write_outputs(
    items: list[str], out_dir: Path, *, list_id: str, generated: date, seed: int = DEFAULT_SEED
) -> dict:
    m, k, actual_seed, bits = build_filter(items, seed=seed)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "tranco.bloom").write_bytes(serialize(m, k, actual_seed, bits))
    meta = {
        "date": generated.isoformat(),
        "list_id": list_id,
        "m": m,
        "k": k,
        "hash_seed": actual_seed,
        "entries": len(items),
        "source": "tranco",
    }
    (out_dir / "tranco.meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    return meta


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the Tranco top-N Bloom filter")
    parser.add_argument("--top", type=int, default=50_000)
    parser.add_argument("--input", type=Path, default=None, help="local Tranco CSV (skips download)")
    parser.add_argument("--list-id", default=None)
    parser.add_argument("--out", type=Path, default=Path("../apps/extension/public"))
    args = parser.parse_args()

    if args.input is not None:
        csv_path = args.input
        list_id = args.list_id or "local"
    else:
        list_id = args.list_id or fetch_latest_list_id()
        csv_path = download_tranco(list_id, 1_000_000, Path("data/raw/tranco.csv"))

    items = read_tranco(csv_path, args.top)
    # Deduplicate while preserving rank order.
    seen: set[str] = set()
    unique: list[str] = []
    for domain in items:
        if domain not in seen:
            seen.add(domain)
            unique.append(domain)

    meta = write_outputs(unique, args.out, list_id=list_id, generated=date.today())
    size_kb = (args.out / "tranco.bloom").stat().st_size / 1024
    print(f"wrote {meta['entries']} entries, m={meta['m']}, k={meta['k']}, {size_kb:.1f} KiB")


if __name__ == "__main__":
    main()

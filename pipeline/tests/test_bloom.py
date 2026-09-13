"""Build a small Bloom filter plus a members/non-members fixture for the TS cross-language test."""

from __future__ import annotations

import json
from pathlib import Path

from build_bloom import build_filter, contains, serialize

FIXTURE_DIR = Path(__file__).resolve().parents[2] / "fixtures" / "bloom"


def build_fixture() -> tuple[list[str], list[str]]:
    members = [f"member-{i}.example" for i in range(1000)]
    non_members = [f"absent-{i}.example" for i in range(1000)]
    m, k, seed, bits = build_filter(members, false_positive_rate=0.01)
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    (FIXTURE_DIR / "bloom.bin").write_bytes(serialize(m, k, seed, bits))
    (FIXTURE_DIR / "bloom_fixture.json").write_text(
        json.dumps(
            {"m": m, "k": k, "hash_seed": seed, "members": members, "non_members": non_members},
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return members, non_members


def test_no_false_negatives() -> None:
    members, _ = build_fixture()
    data = (FIXTURE_DIR / "bloom.bin").read_bytes()
    meta = json.loads((FIXTURE_DIR / "bloom_fixture.json").read_text())
    bits = data[15:]
    for member in members:
        assert contains(bits, meta["m"], meta["k"], meta["hash_seed"], member)


def test_false_positive_rate_under_two_percent() -> None:
    _, non_members = build_fixture()
    data = (FIXTURE_DIR / "bloom.bin").read_bytes()
    meta = json.loads((FIXTURE_DIR / "bloom_fixture.json").read_text())
    bits = data[15:]
    hits = sum(
        1 for item in non_members if contains(bits, meta["m"], meta["k"], meta["hash_seed"], item)
    )
    assert hits / len(non_members) <= 0.02

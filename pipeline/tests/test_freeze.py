from __future__ import annotations

import hashlib
from pathlib import Path

from freeze_dataset import sha256_file


def test_sha256_file(tmp_path: Path) -> None:
    sample = tmp_path / "sample.bin"
    sample.write_bytes(b"abc")
    assert sha256_file(sample) == hashlib.sha256(b"abc").hexdigest()


def test_sha256_file_is_streamed(tmp_path: Path) -> None:
    sample = tmp_path / "big.bin"
    payload = b"x" * 200_000
    sample.write_bytes(payload)
    assert sha256_file(sample) == hashlib.sha256(payload).hexdigest()

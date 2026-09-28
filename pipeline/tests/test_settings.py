from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from settings import Settings, load_settings


def test_load_default_config() -> None:
    settings = load_settings()
    assert settings.crawl.concurrency >= 1
    assert "openphish" in settings.openphish.url
    assert settings.paths.raw_dir == Path("data/raw")


def test_paths_must_be_relative(tmp_path: Path) -> None:
    settings = load_settings()
    payload = settings.model_dump()
    payload["paths"]["data_dir"] = str(tmp_path / "abs")
    with pytest.raises(ValidationError):
        Settings.model_validate(payload)


def test_missing_required_section_fails() -> None:
    settings = load_settings()
    payload = settings.model_dump()
    del payload["crawl"]
    with pytest.raises(ValidationError):
        Settings.model_validate(payload)


def test_tranco_download_base_requires_placeholders() -> None:
    settings = load_settings()
    payload = settings.model_dump()
    payload["tranco"]["download_base"] = "https://example.com/list"
    with pytest.raises(ValidationError):
        Settings.model_validate(payload)


def test_resolve_uses_base_dir(tmp_path: Path) -> None:
    settings = load_settings().model_copy(update={"base_dir": tmp_path})
    assert settings.resolve(Path("data")) == tmp_path / "data"

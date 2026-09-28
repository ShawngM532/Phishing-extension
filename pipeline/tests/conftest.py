"""Shared test fixtures for the pipeline."""

from __future__ import annotations

from pathlib import Path

import pytest

from settings import Settings, load_settings


@pytest.fixture()
def settings(tmp_path: Path) -> Settings:
    """Real config with all data paths redirected into a tmp directory."""
    return load_settings().model_copy(update={"base_dir": tmp_path})

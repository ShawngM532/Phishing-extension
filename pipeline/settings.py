"""Typed, validated configuration for the offline collection pipeline.

`config.yaml` is loaded once and checked by pydantic so a typo fails loudly at
startup rather than halfway through a multi-hour crawl.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml
from pydantic import BaseModel, Field, field_validator

PIPELINE_ROOT = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = PIPELINE_ROOT / "config.yaml"


class OpenPhishConfig(BaseModel):
    url: str
    timeout_seconds: int = Field(gt=0, le=300)
    max_urls: int = Field(gt=0)


class TrancoConfig(BaseModel):
    list_id: str | None = None
    top_n: int = Field(gt=0)
    bloom_top: int = Field(gt=0)
    benign_sample: int = Field(gt=0)
    download_base: str

    @field_validator("download_base")
    @classmethod
    def _has_placeholders(cls, value: str) -> str:
        if "{list_id}" not in value or "{count}" not in value:
            raise ValueError("download_base must contain {list_id} and {count}")
        return value


class CrawlConfig(BaseModel):
    concurrency: int = Field(gt=0, le=64)
    timeout_seconds: int = Field(gt=0, le=120)
    user_agent: str = Field(min_length=1)
    block_resource_types: list[str]
    max_html_bytes: int = Field(gt=0)
    retries: int = Field(ge=0, le=5)
    headless: bool = True


class PathsConfig(BaseModel):
    data_dir: Path
    raw_dir: Path
    html_dir: Path
    crawled_dir: Path

    @field_validator("data_dir", "raw_dir", "html_dir", "crawled_dir", mode="before")
    @classmethod
    def _relative(cls, value: str | Path) -> Path:
        path = Path(value)
        if path.is_absolute():
            raise ValueError("paths must be relative to the pipeline directory")
        return path


class CollectionConfig(BaseModel):
    every_hours: int = Field(gt=0, le=168)
    phishing_within_hours: int = Field(gt=0, le=72)


class Settings(BaseModel):
    openphish: OpenPhishConfig
    tranco: TrancoConfig
    crawl: CrawlConfig
    paths: PathsConfig
    collection: CollectionConfig
    # Base directory that relative paths resolve against. Defaults to the pipeline
    # directory; tests override it with a tmp path via model_copy.
    base_dir: Path = PIPELINE_ROOT

    def resolve(self, relative: Path) -> Path:
        """Resolve a config path against the base directory."""
        return self.base_dir / relative


def load_settings(config_path: Path | None = None) -> Settings:
    path = config_path or DEFAULT_CONFIG_PATH
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError(f"config {path} did not parse to a mapping")
    return Settings.model_validate(raw)


@lru_cache(maxsize=1)
def cached_settings() -> Settings:
    return load_settings()

"""Smoke test: the pipeline toolchain imports cleanly."""

import lightgbm
import numpy
import pandas
import sklearn
import tldextract


def test_lightgbm_importable() -> None:
    assert lightgbm.__version__


def test_optional_imports() -> None:
    assert numpy.__version__
    assert pandas.__version__
    assert sklearn.__version__
    assert tldextract.__version__

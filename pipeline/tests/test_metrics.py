from __future__ import annotations

import numpy as np

from eval.metrics import (
    confusion,
    fpr_at_recall,
    pr_auc,
    roc_auc,
    summarize,
    threshold_sweep,
)


def test_confusion_rates() -> None:
    labels = np.array([1, 1, 0, 0])
    scores = np.array([0.9, 0.2, 0.8, 0.1])
    matrix = confusion(labels, scores, 0.5)
    assert (matrix.tp, matrix.fp, matrix.tn, matrix.fn) == (1, 1, 1, 1)
    assert matrix.precision == 0.5
    assert matrix.recall == 0.5
    assert matrix.fpr == 0.5


def test_perfect_separation() -> None:
    labels = np.array([1, 1, 0, 0])
    scores = np.array([0.9, 0.8, 0.2, 0.1])
    assert roc_auc(labels, scores) == 1.0
    assert pr_auc(labels, scores) == 1.0
    assert fpr_at_recall(labels, scores, 0.95) == 0.0
    assert confusion(labels, scores, 0.5).f1 == 1.0


def test_degenerate_single_class_returns_none() -> None:
    labels = np.array([1, 1, 1])
    scores = np.array([0.1, 0.2, 0.3])
    assert roc_auc(labels, scores) is None
    assert pr_auc(labels, scores) is None
    # No negatives means FPR is undefined but must not crash.
    assert confusion(labels, scores, 0.5).fpr == 0.0


def test_fpr_at_recall_finds_lowest_fpr() -> None:
    labels = np.array([1, 1, 0, 0])
    scores = np.array([0.9, 0.6, 0.65, 0.2])
    # Recall reaches 1.0 at threshold 0.6, which also flags the 0.65 benign page.
    assert fpr_at_recall(labels, scores, 1.0) == 0.5


def test_threshold_sweep_shape() -> None:
    points = threshold_sweep(np.array([1, 0]), np.array([0.9, 0.1]), steps=5)
    assert len(points) == 5
    assert set(points[0]) == {"threshold", "precision", "recall", "fpr"}


def test_summarize_contains_expected_keys() -> None:
    summary = summarize([1, 1, 0, 0], [0.9, 0.8, 0.2, 0.1])
    assert summary["n"] == 4
    assert summary["n_phishing"] == 2
    assert summary["n_benign"] == 2
    assert "at_medium" in summary and "at_high" in summary
    assert len(summary["sweep"]) == 21

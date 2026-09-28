"""Detection metrics computed from continuous scores and binary labels.

Positive class = phishing. A row is predicted positive when `score >= threshold`.
Thresholds default to the extension's `Settings.thresholds` (medium/high).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

MEDIUM_THRESHOLD = 0.35
HIGH_THRESHOLD = 0.75


@dataclass(frozen=True)
class ConfusionMatrix:
    tp: int
    fp: int
    tn: int
    fn: int

    @property
    def precision(self) -> float:
        denominator = self.tp + self.fp
        return self.tp / denominator if denominator else 0.0

    @property
    def recall(self) -> float:
        denominator = self.tp + self.fn
        return self.tp / denominator if denominator else 0.0

    @property
    def fpr(self) -> float:
        denominator = self.fp + self.tn
        return self.fp / denominator if denominator else 0.0

    @property
    def f1(self) -> float:
        precision, recall = self.precision, self.recall
        denominator = precision + recall
        return 2 * precision * recall / denominator if denominator else 0.0

    @property
    def accuracy(self) -> float:
        total = self.tp + self.fp + self.tn + self.fn
        return (self.tp + self.tn) / total if total else 0.0

    def as_dict(self) -> dict[str, float | int]:
        return {
            "tp": self.tp,
            "fp": self.fp,
            "tn": self.tn,
            "fn": self.fn,
            "precision": round(self.precision, 4),
            "recall": round(self.recall, 4),
            "f1": round(self.f1, 4),
            "fpr": round(self.fpr, 4),
            "accuracy": round(self.accuracy, 4),
        }


def confusion(labels: np.ndarray, scores: np.ndarray, threshold: float) -> ConfusionMatrix:
    predicted = scores >= threshold
    positive = labels == 1
    return ConfusionMatrix(
        tp=int(np.sum(predicted & positive)),
        fp=int(np.sum(predicted & ~positive)),
        tn=int(np.sum(~predicted & ~positive)),
        fn=int(np.sum(~predicted & positive)),
    )


def _safe_auc(metric, labels: np.ndarray, scores: np.ndarray) -> float | None:
    if len(np.unique(labels)) < 2:
        return None
    return round(float(metric(labels, scores)), 4)


def roc_auc(labels: np.ndarray, scores: np.ndarray) -> float | None:
    from sklearn.metrics import roc_auc_score

    return _safe_auc(roc_auc_score, labels, scores)


def pr_auc(labels: np.ndarray, scores: np.ndarray) -> float | None:
    from sklearn.metrics import average_precision_score

    return _safe_auc(average_precision_score, labels, scores)


def fpr_at_recall(labels: np.ndarray, scores: np.ndarray, target: float = 0.95) -> float | None:
    """Lowest FPR among thresholds that reach `target` recall (the highest such threshold)."""
    if np.sum(labels == 1) == 0:
        return None
    for threshold in np.unique(scores)[::-1]:
        matrix = confusion(labels, scores, float(threshold))
        if matrix.recall >= target:
            return round(matrix.fpr, 4)
    return None


def threshold_sweep(
    labels: np.ndarray, scores: np.ndarray, steps: int = 21
) -> list[dict[str, float]]:
    points: list[dict[str, float]] = []
    for threshold in np.linspace(0.0, 1.0, steps):
        matrix = confusion(labels, scores, float(threshold))
        points.append(
            {
                "threshold": round(float(threshold), 2),
                "precision": round(matrix.precision, 4),
                "recall": round(matrix.recall, 4),
                "fpr": round(matrix.fpr, 4),
            }
        )
    return points


def summarize(labels: list[int], scores: list[float]) -> dict:
    label_array = np.asarray(labels, dtype=int)
    score_array = np.asarray(scores, dtype=float)
    return {
        "n": int(len(label_array)),
        "n_phishing": int(np.sum(label_array == 1)),
        "n_benign": int(np.sum(label_array == 0)),
        "roc_auc": roc_auc(label_array, score_array),
        "pr_auc": pr_auc(label_array, score_array),
        "fpr_at_recall_95": fpr_at_recall(label_array, score_array, 0.95),
        "at_medium": confusion(label_array, score_array, MEDIUM_THRESHOLD).as_dict(),
        "at_high": confusion(label_array, score_array, HIGH_THRESHOLD).as_dict(),
        "sweep": threshold_sweep(label_array, score_array),
    }

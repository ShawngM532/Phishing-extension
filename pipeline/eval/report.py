"""Render the evaluation report (docs/EVAL.md) and a machine-readable results JSON."""

from __future__ import annotations

from datetime import UTC, datetime

from eval.metrics import HIGH_THRESHOLD, MEDIUM_THRESHOLD


def _pct(value: float | None) -> str:
    return "n/a" if value is None else f"{value * 100:.1f}%"


def _fixed(value: float | None) -> str:
    return "n/a" if value is None else f"{value:.3f}"


def render_markdown(
    title: str,
    summary: dict,
    rows: list[tuple[str, int, float, str]],
    errors: list[str],
) -> str:
    lines: list[str] = []
    lines.append(f"# {title}")
    lines.append("")
    lines.append(f"Generated {datetime.now(UTC).isoformat(timespec='seconds')}.")
    lines.append("")
    lines.append(
        "Scored with the shipping heuristic engine via `pnpm score`, so these numbers "
        "are exactly what the extension computes. Positive class = phishing."
    )
    lines.append("")

    lines.append("## Dataset")
    lines.append("")
    lines.append(f"- Rows scored: **{summary['n']}**")
    lines.append(f"- Phishing: **{summary['n_phishing']}** · Benign: **{summary['n_benign']}**")
    if errors:
        lines.append(f"- Unscorable rows excluded: **{len(errors)}**")
    lines.append("")

    lines.append("## Headline metrics")
    lines.append("")
    lines.append("| Metric | Value |")
    lines.append("| --- | --- |")
    lines.append(f"| ROC-AUC | {_fixed(summary['roc_auc'])} |")
    lines.append(f"| PR-AUC | {_fixed(summary['pr_auc'])} |")
    lines.append(f"| FPR @ recall ≥ 0.95 | {_pct(summary['fpr_at_recall_95'])} |")
    lines.append("")

    for name, key, threshold in (
        ("MEDIUM", "at_medium", MEDIUM_THRESHOLD),
        ("HIGH", "at_high", HIGH_THRESHOLD),
    ):
        matrix = summary[key]
        lines.append(f"## Operating point: {name} (score ≥ {threshold})")
        lines.append("")
        lines.append("| Precision | Recall | F1 | FPR | TP | FP | TN | FN |")
        lines.append("| --- | --- | --- | --- | --- | --- | --- | --- |")
        lines.append(
            f"| {_pct(matrix['precision'])} | {_pct(matrix['recall'])} | {_fixed(matrix['f1'])} | "
            f"{_pct(matrix['fpr'])} | {matrix['tp']} | {matrix['fp']} | {matrix['tn']} | "
            f"{matrix['fn']} |"
        )
        lines.append("")

    lines.append("## Threshold sweep")
    lines.append("")
    lines.append("| Threshold | Precision | Recall | FPR |")
    lines.append("| --- | --- | --- | --- |")
    for point in summary["sweep"]:
        lines.append(
            f"| {point['threshold']:.2f} | {_pct(point['precision'])} | "
            f"{_pct(point['recall'])} | {_pct(point['fpr'])} |"
        )
    lines.append("")

    lines.append("## Per-row results")
    lines.append("")
    lines.append("| URL | Label | Score | Level |")
    lines.append("| --- | --- | --- | --- |")
    for url, label, score, level in rows:
        label_text = "phish" if label == 1 else "benign"
        lines.append(f"| `{url}` | {label_text} | {score:.3f} | {level} |")
    lines.append("")

    if errors:
        lines.append("## Excluded rows")
        lines.append("")
        for error in errors:
            lines.append(f"- {error}")
        lines.append("")

    lines.append("## Limitations")
    lines.append("")
    lines.append(
        "- Small-N fixture corpus: treat these numbers as a plumbing smoke test, not a benchmark."
    )
    lines.append(
        "- Zero-day recall requires dated feed data and a temporal split; not reported here."
    )
    lines.append("")

    return "\n".join(lines)

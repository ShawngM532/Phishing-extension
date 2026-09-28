# Usability evaluation — Sentinel V0

A lightweight, async study of whether the warnings are understandable and
well-calibrated. It complements `docs/EVAL.md` (detection metrics) — this is about
how people respond to the warning UI.

## Research questions

1. Do users understand _why_ a page was flagged from the banner/interstitial?
2. Do they heed a HIGH interstitial (goal: click-through ≤ 15%, PRD §3)?
3. How annoying is the MEDIUM banner (false-positive pain)?
4. Can they find and use the allowlist ("This site is safe") and the popup?

## Participants

- 5–10 people who log into web apps daily (the P1/P2 personas from the PRD).
- Mix of technical and non-technical. Record which, since the copy aims at
  non-technical users.

## Setup

1. Build and install: see `docs/INSTALL-TESTERS.md` (`pnpm build && pnpm pack:zip`).
2. Confirm the pinned toolbar icon appears and the popup opens.
3. Share the task sheet and the feedback form below.

No telemetry is collected by the extension; all input is the participant's own
words. Do not ask participants to enter real credentials on any page.

## Tasks (run in this order)

**T1 — Decide on a suspicious page.**
Open the HIGH fixture (an IP-host login). Record the participant's first reaction
and whether they would type a password. Ask them to reach a decision.

**T2 — Explain the warning.**
Ask: "In your own words, why did Sentinel warn you?" Score 0–2
(0 = wrong/no idea, 1 = partial, 2 = correct). Note which reason chips they cite.

**T3 — Trust a site.**
On a MEDIUM fixture, ask them to make the warning stop for a site they actually
trust. Observe whether they find "This site is safe" or the popup toggle.

**T4 — Check a link (optional).**
Ask them to use the popup's "Check a link" on a link they were sent.

## Metrics

| Metric                | How measured                                     |
| --------------------- | ------------------------------------------------ |
| T2 explanation score  | 0–2, above                                       |
| HIGH click-through    | Would they proceed? (target ≤ 15%)               |
| Time to decision      | Seconds from warning shown to action             |
| Allowlist findability | T3 success without help (yes/no)                 |
| Annoyance             | 1–5 (1 = not annoying, 5 = very annoying)        |
| Trust                 | 1–5 (1 = trust less than before, 5 = trust more) |

## Feedback form template

> Copy into a form or a shared doc; one response per participant.

1. Participant ID / background (technical? yes/no):
2. T2 explanation score (0–2) and their words:
3. On T1, would you have typed your password? (yes/no/unsure) — why?
4. Time to decision (seconds):
5. T3: could you make the warning stop without help? (yes/no)
6. Annoyance 1–5:
7. Trust 1–5:
8. Anything confusing or missing?
9. Optional: URL where you saw a wrong verdict (false positive) + the reason codes shown:

## Analysis

- Report each metric as a small table (n, median/range) in `docs/USABILITY.md`.
- Quote 2–3 verbatim comments for the highlights.
- Map every "confusing" comment to a concrete copy/UI change or a backlog item.
- If HIGH click-through > 15%, treat it as a blocker for the warning copy, not the
  detector.

## Threats to validity

- Tiny sample and one facilitator ⇒ not statistically meaningful; directional only.
- The fixture pages are authored by us and may look cleaner than real phishing.
- Participants may behave differently when they know they are being observed.

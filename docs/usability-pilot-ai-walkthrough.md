# Usability pilot — N=1 AI-conducted walkthrough

**Status: preliminary, directional only.** This is a single walkthrough of the built extension (`apps/extension/dist`, Sentinel v0.1.0) conducted by Claude via browser automation (Chrome DevTools-level clicks/screenshots), following the task structure in [`USABILITY.md`](./USABILITY.md). **It is not a substitute for the 5–10 human-participant study `USABILITY.md` specifies** — see Threats to Validity below. Its purpose is to surface obvious UX issues early and give a first, real (not hypothetical) data point for the report's Evaluation section.

## Setup actually used
- Fixture server: `pnpm exec tsx tests/e2e/serve.ts` (`http://localhost:4321`).
- Extension: built via existing `apps/extension/dist`, loaded unpacked into Chrome by the human operator (browser automation cannot reach `chrome://extensions`, an internal page).
- **Deviation from the fixture corpus's intended URLs:** `fixtures/pages/corpus/cases.json` addresses phishing/edge fixtures via purpose-built hostnames (e.g. `wallet-verify.test`, `paypa1-login.test`) that require `/etc/hosts`-style entries to resolve. Editing the system hosts file was out of scope for this pass, so fixtures were instead loaded via `127.0.0.1`/`localhost`, which the static file server happily serves regardless of `Host` header. This means:
  - `phish/ip-login.html` (designed to be reached via `127.0.0.1` anyway) is a **fully faithful** test.
  - Other phish/benign/edge fixtures were reached via a *different* hostname than designed, so any purely **hostname-pattern** heuristic (typosquat-style domain, brand-lookalike host) could not be validated in this pass — only content/DOM-structure heuristics (insecure password field, late-injected form, urgency language, etc.) were exercised. This is a real gap, not just a caveat; a follow-up pass with hosts-file entries (or `--host-resolver-rules`) is needed to validate the hostname-based signals end-to-end.

## Task-by-task results

### T1 — Decide on a suspicious page (`phish/ip-login.html` via `http://127.0.0.1:4321/...`)
The extension did **not** wait for a click — it blocked the page immediately (within ~2s of load, before any interaction) with a full-screen interstitial:

> **Stop — this page is probably phishing.**
> The web address is a raw number instead of a normal site name.
> - You are being asked for a password on an insecure page.
> - A login form appeared after the page had already loaded.

Buttons: **Go back** (red, primary) / *I understand the risk, continue* (text link).

- **Would I type a password?** No — decision was effectively made for me by the blocking interstitial; the friction is high by design.
- **Time to decision:** near-instant; the interstitial pre-empts any interaction.
- Clicking through ("I understand the risk, continue") surfaces a **second** confirmation: *"Are you sure? Passwords typed here may be stolen. Continue?"* (Continue anyway / Cancel) — i.e. HIGH-risk click-through requires two deliberate confirmations, not one. This is stronger friction than the "click-through rate ≤15%" metric in `USABILITY.md` assumes (which implies a single warning to click past); worth noting in the report as a design strength.
- Proceeding past both leaves a **persistent top banner**: *"You chose to proceed. Be careful."* + the same reason chips + a **"This site is safe"** button + **Dismiss**.

### T2 — Explain the warning
No popup click was needed — the interstitial and persistent banner state the reasons inline, verbatim, in plain language (raw IP address, insecure password page, late-injected login form). Scored against the `USABILITY.md` 0–2 rubric: **2/2** — the reasons are specific and map directly to real signals (not a generic "this looks suspicious").

### T3 — Trust a site (allowlist)
Using the **"This site is safe"** button surfaced in the persistent banner (visible without opening any popup):
- **Findability without help: yes**, immediately visible, one click, no hunting required.
- Verified persistence: reloading `phish/ip-login.html` after clicking "This site is safe" showed the plain page with **no** interstitial and **no** banner — allowlist took effect and survived a reload.

### T3b — Same flow on `phish/http-login.html` (intended MEDIUM per `docs/eval-results.json`, reached via `localhost` instead of its designed `login.example.test` host)
This also produced the **same full-screen blocking interstitial** as the HIGH case (reasons: insecure password page, late-injected form, insecure connection), not a lighter-weight badge/banner-only treatment. This is a genuine, real finding worth double-checking against source — either:
1. Accessing via `localhost` instead of the designed hostname pushed the score from MEDIUM into HIGH territory (plausible — losing a hostname-based mitigating/aggravating signal shifts total score), or
2. The current build's UI treats MEDIUM and HIGH the same way (a blocking interstitial) rather than differentiating tiers.
Recommend the project team re-run this specific case via the intended hostname (with a hosts-file entry) to distinguish these two explanations before citing a MEDIUM-specific UX claim in the report.

### T4 — Popup "check a link" (optional)
**Not tested.** Browser automation in this session can only interact with page content, not the browser's toolbar/extension-popup surface — `chrome://extensions` and the toolbar popup are both outside what the automation tooling can reach. This task needs a human tester or a differently-privileged automation setup (e.g. Playwright's extension-testing APIs, which `tests/e2e/` already uses for exactly this reason).

### False-positive sanity check — `benign/bank-login.html` (via `localhost`, not its designed `bank.example.test` host)
No warning, no banner — clean pass. Only one benign case checked; not enough to make a false-positive-rate claim beyond what `docs/eval-results.json` already reports (0 FP at both thresholds on the full 20-row corpus).

## Metrics summary (n = 1)

| Metric | Result |
|---|---|
| T2 explanation score | 2/2 |
| HIGH-risk click-through | 0% (declined both confirmations) — but note only 1 trial |
| Time to decision | ~instant (auto-blocking, not user-paced) |
| Allowlist findability without help | Yes |
| Annoyance (1–5) | Not meaningfully ratable by a single non-human pass — skipped |
| Trust (1–5) | Not meaningfully ratable by a single non-human pass — skipped |

## Threats to validity
- **N=1, and the "1" is an AI walkthrough, not a human.** No claim here generalizes; annoyance/trust/comprehension ratings require actual human participants as `USABILITY.md` specifies, and are intentionally left blank rather than fabricated.
- **Hostname mismatch** for all fixtures except `ip-login`, as detailed above — content/DOM heuristics were exercised, hostname-pattern heuristics were not.
- **Toolbar badge and popup UI were never observed** — only in-page interstitial/banner surfaces were reachable by this tooling. The report should not claim anything about badge color or popup layout based on this pilot.
- **Single trial per task** — no repetition, no counterbalancing, no varied fixture order.

## Recommended next step
Run the real `USABILITY.md` protocol with 5–10 human participants, ideally after adding the missing hosts-file setup step (or a `--host-resolver-rules`-launched Chromium, as `tests/e2e/` likely already does) so every fixture is reached via its intended hostname.

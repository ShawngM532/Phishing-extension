# Installing the Sentinel V0 build (testers)

1. Build the extension:
   ```
   pnpm install
   pnpm build
   pnpm pack:zip
   ```
   This produces `artifacts/sentinel-0.1.0.zip` and an unpacked `apps/extension/dist/`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Drag `artifacts/sentinel-0.1.0.zip` onto the page (or click **Load unpacked** and select
   `apps/extension/dist`).
4. Pin Sentinel to the toolbar.

## What to expect

- **Green badge** — nothing to do.
- **Amber badge + banner** — the page looks a bit off. Read the reasons, then Dismiss or mark the
  site safe.
- **Red badge + full-screen warning** — the page is probably phishing. Password fields are locked
  until you choose to continue.

## Reporting a false positive

1. Open the Sentinel popup on the page.
2. Note the reason lines shown.
3. Click **Trust this site** (this allowlists the domain).
4. Send the URL and the reason lines to the team.

## Reporting a miss

Send the URL, a screenshot, and (if you are comfortable) the page HTML. Do not enter real
credentials on any page you suspect.

## Notes

- All analysis is on-device; the extension makes no network requests. The only outbound request is
  the manual "Deep scan" you trigger yourself (V1).
- To reset, remove and re-add the extension.

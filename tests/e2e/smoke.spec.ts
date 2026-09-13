import { expect, FIXTURE_ORIGIN, tabIdForUrl, test, waitForTabState } from './fixtures';

test('smoke: navigating to a fixture creates tab state', async ({ context, extensionId }) => {
  expect(extensionId).toBeTruthy();

  const url = `${FIXTURE_ORIGIN}/smoke.html`;
  const page = await context.newPage();
  await page.goto(url);

  const tabId = await tabIdForUrl(context, url);
  expect(tabId).not.toBeNull();

  const state = await waitForTabState(context, tabId ?? -1, (candidate) => candidate !== null);
  expect(state?.url).toBe(url);
  expect(state?.extractorVersion).toBe(1);
  expect(state?.proceeded).toBe(false);
});

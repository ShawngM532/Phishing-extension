import { expect, tabIdForUrl, test, waitForTabState } from './fixtures';

test('a login form on an IP-host page is flagged HIGH', async ({ context, extensionId }) => {
  expect(extensionId).toBeTruthy();

  const url = 'http://127.0.0.1:4321/phish/ip-login.html';
  const page = await context.newPage();
  await page.goto(url);

  const tabId = await tabIdForUrl(context, url);
  expect(tabId).not.toBeNull();

  const state = await waitForTabState(
    context,
    tabId ?? -1,
    (candidate) => candidate?.final?.level === 'HIGH',
  );

  expect(state?.final?.level).toBe('HIGH');
  expect(state?.final?.engine).toBe('heuristic');
});

import { expect, test, waitForE2eUi } from './fixtures';

const HIGH_URL = 'http://127.0.0.1:4321/corpus/phish/ip-login.html';

test('page script cannot reach the closed shadow root', async ({ context, extensionId }) => {
  expect(extensionId).toBeTruthy();

  const page = await context.newPage();
  await page.goto(HIGH_URL);

  // The content script renders the warning in a closed shadow root...
  await waitForE2eUi(context, page, { selector: '.overlay' });

  // ...which page-world script cannot see.
  const exposed = await page.evaluate(() => {
    const host = document.querySelector('sentinel-root');
    return { hasHost: host !== null, shadowRoot: host?.shadowRoot ?? null };
  });

  expect(exposed.hasHost).toBe(true);
  expect(exposed.shadowRoot).toBeNull();
});

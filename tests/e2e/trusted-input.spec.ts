import { e2eProgrammaticClick, e2eUi, expect, test, waitForE2eUi } from './fixtures';

const MEDIUM_URL = 'http://login.example.test:4321/corpus/phish/http-login.html';
const HIGH_URL = 'http://127.0.0.1:4321/corpus/phish/ip-login.html';

test('programmatic clicks cannot proceed through a HIGH interstitial', async ({
  context,
  extensionId,
}) => {
  expect(extensionId).toBeTruthy();

  const page = await context.newPage();
  await page.goto(HIGH_URL);
  await waitForE2eUi(context, page, { selector: '.overlay' });

  // `element.click()` inside the isolated world is untrusted and must be ignored.
  await e2eProgrammaticClick(context, page, { text: 'I understand the risk, continue' });
  expect((await e2eUi(context, page, { text: 'Continue anyway' })).count).toBe(0);
  expect((await e2eUi(context, page, { selector: '.overlay' })).visible).toBe(true);

  // "Go back" must not navigate or close the tab either.
  await e2eProgrammaticClick(context, page, { text: 'Go back' });
  expect(page.url()).toBe(HIGH_URL);
  expect((await e2eUi(context, page, { selector: '.overlay' })).visible).toBe(true);

  // A synthetic click dispatched from the page world is also ignored.
  await page.evaluate(() => {
    const host = document.querySelector('sentinel-root');
    host?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  });
  expect((await e2eUi(context, page, { selector: '.overlay' })).visible).toBe(true);
});

test('programmatic clicks cannot dismiss or allowlist a MEDIUM banner', async ({
  context,
  extensionId,
}) => {
  expect(extensionId).toBeTruthy();

  const page = await context.newPage();
  await page.goto(MEDIUM_URL);
  await waitForE2eUi(context, page, { selector: '.banner' });

  await e2eProgrammaticClick(context, page, { text: 'Dismiss' });
  expect((await e2eUi(context, page, { selector: '.banner' })).visible).toBe(true);

  await e2eProgrammaticClick(context, page, { text: 'This site is safe' });
  expect((await e2eUi(context, page, { selector: '.banner' })).visible).toBe(true);
});

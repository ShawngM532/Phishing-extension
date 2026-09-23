import { e2eClick, e2eUi, expect, serviceWorker, test, waitForE2eUi } from './fixtures';

const MEDIUM_URL = 'http://login.example.test:4321/corpus/phish/http-login.html';
const HIGH_URL = 'http://127.0.0.1:4321/corpus/phish/ip-login.html';

test('a MEDIUM verdict shows a dismissable banner that persists across reload', async ({
  context,
  extensionId,
}) => {
  expect(extensionId).toBeTruthy();

  const page = await context.newPage();
  await page.goto(MEDIUM_URL);

  await waitForE2eUi(context, page, { selector: '.banner' });
  await e2eClick(context, page, { text: 'Dismiss' });
  await expect
    .poll(async () => (await e2eUi(context, page, { selector: '.banner' })).count)
    .toBe(0);

  await page.reload();
  await page.waitForTimeout(600);
  expect((await e2eUi(context, page, { selector: '.banner' })).count).toBe(0);
});

test('allowlisting a site removes the warning', async ({ context, extensionId }) => {
  expect(extensionId).toBeTruthy();

  const page = await context.newPage();
  await page.goto(MEDIUM_URL);
  await waitForE2eUi(context, page, { selector: '.banner' });

  await e2eClick(context, page, { text: 'This site is safe' });
  await expect
    .poll(async () => (await e2eUi(context, page, { selector: '.banner' })).count)
    .toBe(0);

  await page.reload();
  await page.waitForTimeout(600);
  expect((await e2eUi(context, page, { selector: '.banner' })).count).toBe(0);
});

test('a HIGH verdict blocks password entry until the user proceeds', async ({
  context,
  extensionId,
}) => {
  expect(extensionId).toBeTruthy();

  const page = await context.newPage();
  await page.goto(HIGH_URL);

  await waitForE2eUi(context, page, { selector: '.overlay' });
  const password = page.locator('input[type=password]').first();
  await expect(password).toHaveJSProperty('readOnly', true);

  await e2eClick(context, page, { text: 'I understand the risk, continue' });
  await e2eClick(context, page, { text: 'Continue anyway' });

  await expect
    .poll(async () => (await e2eUi(context, page, { selector: '.overlay' })).count)
    .toBe(0);
  await expect(password).toHaveJSProperty('readOnly', false);
});

test('form submission is blocked while a HIGH verdict is active', async ({
  context,
  extensionId,
}) => {
  expect(extensionId).toBeTruthy();

  const page = await context.newPage();
  await page.goto(HIGH_URL);
  await waitForE2eUi(context, page, { selector: '.overlay' });

  const prevented = await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form === null) return false;
    const event = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    return event.defaultPrevented;
  });

  expect(prevented).toBe(true);
  expect(page.url()).toBe(HIGH_URL);
});

test('global disable suppresses all warnings', async ({ context, extensionId }) => {
  expect(extensionId).toBeTruthy();

  const worker = await serviceWorker(context);
  await worker.evaluate(async () => {
    const stored = await chrome.storage.sync.get('settings');
    const settings = (stored.settings as Record<string, unknown> | undefined) ?? {
      allowlist: [],
      thresholds: { medium: 0.35, high: 0.75 },
    };
    settings.enabled = false;
    await chrome.storage.sync.set({ settings });
  });

  const page = await context.newPage();
  await page.goto(HIGH_URL);
  await page.waitForTimeout(1000);

  expect((await e2eUi(context, page, { selector: '.overlay' })).count).toBe(0);
  expect((await e2eUi(context, page, { selector: '.banner' })).count).toBe(0);
});

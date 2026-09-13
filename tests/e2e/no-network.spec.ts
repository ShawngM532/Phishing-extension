import { expect, EXTENSION_SCHEME, FIXTURE_ORIGIN, test } from './fixtures';

test('the extension initiates zero network requests', async ({ context, extensionId }) => {
  expect(extensionId).toBeTruthy();

  const offenders: string[] = [];

  context.on('request', (request) => {
    const url = request.url();
    if (!/^https?:/i.test(url)) return;

    const worker = request.serviceWorker();
    const fromExtensionWorker = worker?.url().startsWith(EXTENSION_SCHEME) ?? false;

    const fromExtensionPage = (() => {
      try {
        return request.frame().url().startsWith(EXTENSION_SCHEME);
      } catch {
        return false;
      }
    })();

    if (fromExtensionWorker || fromExtensionPage) offenders.push(url);
  });

  const page = await context.newPage();
  for (let index = 1; index <= 20; index += 1) {
    const suffix = String(index).padStart(2, '0');
    await page.goto(`${FIXTURE_ORIGIN}/benign/article-${suffix}.html`);
  }
  await page.close();

  expect(offenders).toEqual([]);
});

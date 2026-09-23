import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { e2eShadowHtml, e2eUi, expect, test, waitForE2eUi } from './fixtures';

const MEDIUM_URL = 'http://login.example.test:4321/corpus/phish/http-login.html';
const HIGH_URL = 'http://127.0.0.1:4321/corpus/phish/ip-login.html';

const CLONE_ID = 'sentinel-e2e-clone';

/**
 * Mirrors the closed shadow-root markup into an open shadow root so axe can
 * traverse it. The markup (including its inline `<style>`) is byte-identical to
 * what renders in production, so styles and semantics are preserved.
 */
async function mountAxeClone(page: Page, markup: string): Promise<void> {
  await page.evaluate((html) => {
    document.getElementById('sentinel-e2e-clone')?.remove();
    const host = document.createElement('div');
    host.id = 'sentinel-e2e-clone';
    document.body.append(host);
    host.attachShadow({ mode: 'open' }).innerHTML = html;
  }, markup);
}

test('the MEDIUM banner has no accessibility violations', async ({ context, extensionId }) => {
  expect(extensionId).toBeTruthy();
  const page = await context.newPage();
  await page.goto(MEDIUM_URL);
  await waitForE2eUi(context, page, { selector: '.banner' });

  await mountAxeClone(page, await e2eShadowHtml(context, page));
  const results = await new AxeBuilder({ page }).include(`#${CLONE_ID}`).analyze();
  expect(results.violations).toEqual([]);
});

test('the HIGH interstitial has no accessibility violations', async ({ context, extensionId }) => {
  expect(extensionId).toBeTruthy();
  const page = await context.newPage();
  await page.goto(HIGH_URL);
  await waitForE2eUi(context, page, { selector: '.overlay' });

  await mountAxeClone(page, await e2eShadowHtml(context, page));
  const results = await new AxeBuilder({ page }).include(`#${CLONE_ID}`).analyze();
  expect(results.violations).toEqual([]);
});

test('the banner dismisses on Escape', async ({ context, extensionId }) => {
  expect(extensionId).toBeTruthy();
  const page = await context.newPage();
  await page.goto(MEDIUM_URL);
  await waitForE2eUi(context, page, { selector: '.banner' });

  await page.keyboard.press('Escape');
  await expect
    .poll(async () => (await e2eUi(context, page, { selector: '.banner' })).count)
    .toBe(0);
});

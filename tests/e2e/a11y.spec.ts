import AxeBuilder from '@axe-core/playwright';

import { expect, test } from './fixtures';

const MEDIUM_URL = 'http://login.example.test:4321/corpus/phish/http-login.html';
const HIGH_URL = 'http://127.0.0.1:4321/corpus/phish/ip-login.html';

test('the MEDIUM banner has no accessibility violations', async ({ context, extensionId }) => {
  expect(extensionId).toBeTruthy();
  const page = await context.newPage();
  await page.goto(MEDIUM_URL);
  await expect(page.locator('.banner')).toBeVisible();

  const results = await new AxeBuilder({ page }).include('sentinel-root').analyze();
  expect(results.violations).toEqual([]);
});

test('the HIGH interstitial has no accessibility violations', async ({ context, extensionId }) => {
  expect(extensionId).toBeTruthy();
  const page = await context.newPage();
  await page.goto(HIGH_URL);
  await expect(page.locator('.overlay')).toBeVisible();

  const results = await new AxeBuilder({ page }).include('sentinel-root').analyze();
  expect(results.violations).toEqual([]);
});

test('the banner dismisses on Escape', async ({ context, extensionId }) => {
  expect(extensionId).toBeTruthy();
  const page = await context.newPage();
  await page.goto(MEDIUM_URL);
  await expect(page.locator('.banner')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.banner')).toHaveCount(0);
});

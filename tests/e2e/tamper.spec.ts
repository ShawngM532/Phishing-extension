import { e2eUi, expect, test, waitForE2eUi } from './fixtures';

const TAMPER_URL = 'http://127.0.0.1:4321/tamper/tamper-login.html';

test('page tampering cannot un-block a HIGH page', async ({ context, extensionId }) => {
  expect(extensionId).toBeTruthy();

  const page = await context.newPage();
  await page.goto(TAMPER_URL);
  await waitForE2eUi(context, page, { selector: '.overlay' });

  // The fixture tamper script runs at 700ms and 1500ms; wait past both.
  await page.waitForTimeout(2300);

  // The overlay was re-attached even though the page removed the host element.
  expect((await e2eUi(context, page, { selector: '.overlay' })).visible).toBe(true);

  const state = await page.evaluate(() => ({
    inert: document.body.hasAttribute('inert'),
    hostCount: document.querySelectorAll('sentinel-root').length,
    passwords: Array.from(document.querySelectorAll('input[type=password]')).map((input) => ({
      readOnly: (input as HTMLInputElement).readOnly,
      autocomplete: input.getAttribute('autocomplete'),
    })),
  }));

  expect(state.inert).toBe(true);
  expect(state.hostCount).toBe(1);
  expect(state.passwords.length).toBeGreaterThanOrEqual(2);
  for (const password of state.passwords) {
    expect(password.readOnly).toBe(true);
    expect(password.autocomplete).toBe('off');
  }

  // Typing still cannot reach any password field.
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('input[type=password]');
    input?.focus();
  });
  await page.keyboard.type('hunter2');
  await expect(page.locator('input[type=password]').first()).toHaveValue('');
  await expect(page.locator('#injected-password').last()).toHaveValue('');
});

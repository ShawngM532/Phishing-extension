import { expect, test, waitForE2eUi } from './fixtures';

const HIGH_URL = 'http://127.0.0.1:4321/corpus/phish/ip-login.html';

test('keystrokes and clipboard paste cannot fill a credential field on HIGH', async ({
  context,
  extensionId,
}) => {
  expect(extensionId).toBeTruthy();

  const page = await context.newPage();
  await page.goto(HIGH_URL);
  await waitForE2eUi(context, page, { selector: '.overlay' });

  const password = page.locator('input[type=password]').first();

  // The capture-phase guard on `document` cancels these for credential fields.
  const prevented = await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('input[type=password]');
    if (input === null) return null;
    const keydown = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    const beforeinput = new InputEvent('beforeinput', { bubbles: true, cancelable: true });
    const paste = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
    input.dispatchEvent(keydown);
    input.dispatchEvent(beforeinput);
    input.dispatchEvent(paste);
    return {
      keydown: keydown.defaultPrevented,
      beforeinput: beforeinput.defaultPrevented,
      paste: paste.defaultPrevented,
    };
  });
  expect(prevented).toEqual({ keydown: true, beforeinput: true, paste: true });

  // Programmatic focus + real keystrokes (capture-phase keydown guard).
  await page.evaluate(() => {
    document.querySelector<HTMLInputElement>('input[type=password]')?.focus();
  });
  await page.keyboard.type('hunter2');
  await expect(password).toHaveValue('');

  // Real clipboard paste (capture-phase paste/beforeinput guard).
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(async () => {
    await navigator.clipboard.writeText('pasted-secret');
    document.querySelector<HTMLInputElement>('input[type=password]')?.focus();
  });
  await page.keyboard.press('Control+V');
  await expect(password).toHaveValue('');
});

import { test as base, chromium, expect, type BrowserContext, type Worker } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const EXTENSION_PATH = join(HERE, '..', '..', 'apps', 'extension', 'dist');
export const FIXTURE_ORIGIN = 'http://localhost:4321';
export const EXTENSION_SCHEME = 'chrome-extension://';

const HOST_ALIASES = [
  'paypa1-login.test',
  'secure-verify.test',
  'login.example.test',
  'account-update.test',
  'wallet-verify.test',
  'evil.test',
  '*.evil.test',
  'secure-login.test',
  'paypal-secure.test',
  'verify-account.test',
  'example.test',
  'bank.example.test',
  'edge.test',
  'xero-secure-login.test',
  'micros0ft-login.test',
];
const HOST_RESOLVER_RULES = HOST_ALIASES.map((host) => `MAP ${host} 127.0.0.1`).join(', ');

/** Minimal shape of the extension's TabState, kept local so e2e does not import app code. */
export interface E2ETabState {
  tabId: number;
  url: string;
  stage1: { level: string } | null;
  stage2: { level: string } | null;
  final: { level: string; engine?: string } | null;
  proceeded: boolean;
  dismissed: boolean;
  extractorVersion: number;
  modelVersion: number | null;
  timings?: { stage1Ms?: number; stage2Ms?: number };
}

export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  // Playwright requires the first argument to be an object destructuring pattern.
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        `--host-resolver-rules=${HOST_RESOLVER_RULES}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    const worker = await serviceWorker(context);
    await waitForBackgroundReady(worker);
    await use(new URL(worker.url()).host);
  },
});

export { expect };

/** Waits until the background module has executed and registered its listeners. */
export async function waitForBackgroundReady(worker: Worker, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await worker.evaluate(() => chrome.webNavigation.onBeforeNavigate.hasListeners());
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('background service worker did not register listeners in time');
}

export async function serviceWorker(context: BrowserContext): Promise<Worker> {
  const existing = context.serviceWorkers();
  const found = existing[0];
  if (found) return found;
  return context.waitForEvent('serviceworker');
}

export async function tabIdForUrl(context: BrowserContext, url: string): Promise<number | null> {
  const worker = await serviceWorker(context);
  return worker.evaluate(async (target) => {
    const tabs = await chrome.tabs.query({});
    const match = tabs.find((tab) => tab.url === target);
    return match?.id ?? null;
  }, url);
}

export async function getTabState(
  context: BrowserContext,
  tabId: number,
): Promise<E2ETabState | null> {
  const worker = await serviceWorker(context);
  return worker.evaluate(async (id) => {
    const key = `tab:${String(id)}`;
    const stored = await chrome.storage.session.get(key);
    return (stored[key] as E2ETabState | undefined) ?? null;
  }, tabId);
}

export async function waitForTabState(
  context: BrowserContext,
  tabId: number,
  predicate: (state: E2ETabState | null) => boolean,
  timeoutMs = 5_000,
): Promise<E2ETabState | null> {
  const deadline = Date.now() + timeoutMs;
  let last: E2ETabState | null = null;
  while (Date.now() < deadline) {
    last = await getTabState(context, tabId);
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return last;
}

/** Shape returned by the E2E-only bridge in `apps/extension/src/content/e2e-bridge.ts`. */
export interface E2EUiResult {
  count: number;
  visible: boolean;
  text: string | null;
  html: string | null;
  rect: { x: number; y: number; width: number; height: number } | null;
}

export interface E2EUiQuery {
  selector?: string;
  text?: string;
}

const EMPTY_E2E_UI: E2EUiResult = {
  count: 0,
  visible: false,
  text: null,
  html: null,
  rect: null,
};

async function sendE2E(
  context: BrowserContext,
  tabId: number,
  payload: Record<string, unknown>,
): Promise<E2EUiResult> {
  const worker = await serviceWorker(context);
  const result = await worker.evaluate<
    E2EUiResult | null,
    { tabId: number; payload: Record<string, unknown> }
  >(
    async (args) => {
      try {
        return await chrome.tabs.sendMessage(args.tabId, args.payload, { frameId: 0 });
      } catch {
        return null;
      }
    },
    {
      tabId,
      payload,
    },
  );
  return result ?? EMPTY_E2E_UI;
}

/** Queries the closed shadow root through the isolated-world bridge. */
export async function e2eUi(
  context: BrowserContext,
  page: { url(): string },
  query: E2EUiQuery,
): Promise<E2EUiResult> {
  const tabId = await tabIdForUrl(context, page.url());
  if (tabId === null) return EMPTY_E2E_UI;
  return sendE2E(context, tabId, { type: 'E2E_UI', action: 'query', ...query });
}

/** Returns the full shadow-root HTML (used for axe on an open mirror). */
export async function e2eShadowHtml(
  context: BrowserContext,
  page: { url(): string },
): Promise<string> {
  const tabId = await tabIdForUrl(context, page.url());
  if (tabId === null) return '';
  const result = await sendE2E(context, tabId, { type: 'E2E_UI', action: 'html' });
  return result.html ?? '';
}

/** Polls the bridge until the query matches `predicate` (default: visible and present). */
export async function waitForE2eUi(
  context: BrowserContext,
  page: { url(): string },
  query: E2EUiQuery,
  predicate: (result: E2EUiResult) => boolean = (result) => result.count > 0 && result.visible,
  timeoutMs = 5_000,
): Promise<E2EUiResult> {
  const deadline = Date.now() + timeoutMs;
  let last = EMPTY_E2E_UI;
  while (Date.now() < deadline) {
    last = await e2eUi(context, page, query);
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return last;
}

/**
 * Fires an untrusted programmatic `element.click()` inside the isolated world.
 * Used to prove the trusted-input guard ignores synthetic events.
 */
export async function e2eProgrammaticClick(
  context: BrowserContext,
  page: { url(): string },
  query: E2EUiQuery,
): Promise<E2EUiResult> {
  const tabId = await tabIdForUrl(context, page.url());
  if (tabId === null) return EMPTY_E2E_UI;
  return sendE2E(context, tabId, { type: 'E2E_UI', action: 'click-programmatic', ...query });
}

/** Clicks an element inside the closed shadow root with a real (trusted) mouse event. */
export async function e2eClick(
  context: BrowserContext,
  page: { url(): string; mouse: { click(x: number, y: number): Promise<void> } },
  query: E2EUiQuery,
): Promise<void> {
  const result = await waitForE2eUi(context, page, query);
  if (result.rect === null) {
    throw new Error(`e2eClick: target not found for ${JSON.stringify(query)}`);
  }
  const { x, y, width, height } = result.rect;
  await page.mouse.click(x + width / 2, y + height / 2);
}

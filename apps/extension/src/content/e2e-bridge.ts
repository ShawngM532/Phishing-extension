/**
 * Test-only bridge into the closed shadow root.
 *
 * This module is only installed when the build flag `__SENTINEL_E2E__` is true
 * (Vite `--mode e2e`), so it never ships in a production build. It lives in the
 * content script's isolated world and is reached with `chrome.tabs.sendMessage`
 * (never a page-world global), so page script cannot use it.
 */

export const E2E_UI_MESSAGE_TYPE = 'E2E_UI';

export interface E2EUiQuery {
  selector?: string;
  text?: string;
}

export interface E2EUiRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface E2EUiResult {
  count: number;
  visible: boolean;
  text: string | null;
  html: string | null;
  rect: E2EUiRect | null;
}

interface E2EUiMessage {
  type?: unknown;
  action?: unknown;
  selector?: unknown;
  text?: unknown;
}

const EMPTY_RESULT: E2EUiResult = {
  count: 0,
  visible: false,
  text: null,
  html: null,
  rect: null,
};

function findTarget(root: ShadowRoot, query: E2EUiQuery): Element | null {
  if (query.text !== undefined) {
    const interactive = Array.from(root.querySelectorAll('button, a, [role="button"]'));
    const button = interactive.find((element) => element.textContent.trim() === query.text);
    if (button !== undefined) return button;
    return (
      Array.from(root.querySelectorAll('*')).find(
        (element) => element.textContent.trim() === query.text,
      ) ?? null
    );
  }
  if (query.selector !== undefined) return root.querySelector(query.selector);
  return null;
}

function queryUi(root: ShadowRoot, query: E2EUiQuery): E2EUiResult {
  let count = 0;
  if (query.selector !== undefined) {
    count = root.querySelectorAll(query.selector).length;
  } else if (query.text !== undefined) {
    count = Array.from(root.querySelectorAll('*')).filter(
      (element) => element.textContent.trim() === query.text,
    ).length;
  }

  const target = findTarget(root, query);
  if (target === null) return { ...EMPTY_RESULT, count };

  const rect = target.getBoundingClientRect();
  const style = window.getComputedStyle(target);
  const visible =
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0';

  return {
    count,
    visible,
    text: target.textContent.trim(),
    html: null,
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
  };
}

/** Registers the isolated-world listener. Call once per frame, E2E builds only. */
export function installE2EBridge(getRoot: () => ShadowRoot): void {
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (typeof message !== 'object' || message === null) return undefined;
    const typed = message as E2EUiMessage;
    if (typed.type !== E2E_UI_MESSAGE_TYPE) return undefined;

    const root = getRoot();
    if (typed.action === 'html') {
      sendResponse({ ...EMPTY_RESULT, html: root.innerHTML });
      return true;
    }

    const query: E2EUiQuery = {};
    if (typeof typed.selector === 'string') query.selector = typed.selector;
    if (typeof typed.text === 'string') query.text = typed.text;

    if (typed.action === 'click-programmatic') {
      const target = findTarget(root, query);
      if (target instanceof HTMLElement) target.click();
      sendResponse(queryUi(root, query));
      return true;
    }

    sendResponse(queryUi(root, query));
    return true;
  });
}

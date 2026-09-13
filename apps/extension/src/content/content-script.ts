import { sendMessage } from '../shared/messages';

declare global {
  interface Window {
    __sentinelInjected?: boolean;
  }
}

const PASSWORD_SELECTOR = 'input[type=password]';

function hasPasswordField(doc: Document): boolean {
  return doc.querySelector(PASSWORD_SELECTOR) !== null;
}

/** Top frame always runs; sub-frames only when they contain a password field. */
function shouldRunHere(): boolean {
  if (window.top === window.self) return true;
  return hasPasswordField(document);
}

async function requestScore(): Promise<void> {
  try {
    const response = await sendMessage({
      type: 'SCORE_REQUEST',
      payload: { url: location.href, features: [], stage: 2, formAddedAfterLoad: false },
    });
    console.log('[sentinel] score result', response.verdict.level);
  } catch (error) {
    console.warn('[sentinel] score request failed', error);
  }
}

function init(): void {
  if (!shouldRunHere()) return;
  void requestScore();
}

if (!window.__sentinelInjected) {
  window.__sentinelInjected = true;
  init();
}

import { extractStage2, parseUrl } from '@sentinel/features';
import type { Verdict } from '@sentinel/heuristics';

import { sendMessage } from '../shared/messages';
import { installSubmitGuard } from './submit-guard';
import { showBanner } from './ui/banner';
import { clearUi, getShadowRoot } from './ui/host';
import { showInterstitial } from './ui/interstitial';

declare global {
  interface Window {
    __sentinelInjected?: boolean;
  }
}

const MAX_RESCORES = 3;
const RESCORE_DEBOUNCE_MS = 250;

let currentVerdict: Verdict | null = null;
let proceeded = false;
let dismissed = false;

function hasPasswordField(doc: Document): boolean {
  return doc.querySelector('input[type=password]') !== null;
}

/** Top frame always runs; sub-frames only when they contain a password field. */
function shouldRunHere(): boolean {
  if (window.top === window.self) return true;
  return hasPasswordField(document);
}

function pageEtld1(): string {
  return parseUrl(location.href)?.etld1 ?? '';
}

function render(): void {
  clearUi();

  const verdict = currentVerdict;
  if (verdict === null || dismissed) return;

  if (verdict.level === 'HIGH' && !proceeded) {
    showInterstitial(getShadowRoot(), verdict, {
      onGoBack: () => {
        if (history.length > 1) {
          history.back();
        } else {
          void sendMessage({ type: 'CLOSE_TAB', payload: {} });
        }
      },
      onProceed: () => {
        proceeded = true;
        void sendMessage({ type: 'PROCEED', payload: {} });
        render();
      },
    });
    return;
  }

  if (verdict.level === 'HIGH') {
    const proceededVerdict: Verdict = {
      ...verdict,
      reasons: [
        { code: 'PROCEEDED', humanText: 'You chose to proceed. Be careful.', weight: 0 },
        ...verdict.reasons,
      ],
    };
    showBanner(getShadowRoot(), proceededVerdict, bannerHandlers());
    return;
  }

  if (verdict.level === 'MEDIUM') {
    showBanner(getShadowRoot(), verdict, bannerHandlers());
  }
}

function bannerHandlers() {
  return {
    onDismiss: (): void => {
      dismissed = true;
      void sendMessage({ type: 'DISMISS', payload: {} });
      clearUi();
    },
    onAllowlist: (): void => {
      const etld1 = pageEtld1();
      if (etld1 !== '') {
        void sendMessage({ type: 'SET_ALLOWLIST', payload: { etld1, allow: true } });
      }
      currentVerdict = null;
      clearUi();
    },
  };
}

async function requestScore(formAddedAfterLoad: boolean): Promise<void> {
  const warnings: string[] = [];
  const startedAt = performance.now();
  const vector = extractStage2(location.href, document, {
    warnings,
    isSubFrame: window.top !== window.self,
    formAddedAfterLoad,
  });
  const extractionMs = performance.now() - startedAt;

  if (warnings.length > 0) {
    console.warn('[sentinel] extraction warnings', warnings);
  }

  try {
    const response = await sendMessage({
      type: 'SCORE_REQUEST',
      payload: {
        url: location.href,
        features: vector === null ? [] : Array.from(vector),
        stage: 2,
        formAddedAfterLoad,
        extractionMs,
      },
    });
    currentVerdict = response.verdict;
    render();
  } catch (error) {
    console.warn('[sentinel] score request failed', error);
  }
}

function installMutationObserver(): void {
  let rescores = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const observer = new MutationObserver(() => {
    if (rescores >= MAX_RESCORES || timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      if (rescores >= MAX_RESCORES) return;
      if (document.querySelector('form, input[type=password]')) {
        rescores += 1;
        void requestScore(true);
      }
    }, RESCORE_DEBOUNCE_MS);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
}

async function restoreState(): Promise<void> {
  try {
    const { state } = await sendMessage({ type: 'GET_TAB_STATE', payload: {} });
    if (state !== null) {
      dismissed = state.dismissed;
      proceeded = state.proceeded;
    }
  } catch {
    // Ignore; scoring will still proceed.
  }
}

function init(): void {
  if (!shouldRunHere()) return;

  installSubmitGuard({
    shouldBlock: () => currentVerdict?.level === 'HIGH' && !proceeded,
    onBlocked: () => {
      if (currentVerdict !== null) render();
    },
  });

  void restoreState().then(() => requestScore(false));
  installMutationObserver();
}

if (!window.__sentinelInjected) {
  window.__sentinelInjected = true;
  init();
}

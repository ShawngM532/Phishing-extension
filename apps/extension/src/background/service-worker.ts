import { EXTRACTOR_VERSION } from '@sentinel/features';
import type { Verdict } from '@sentinel/heuristics';

import { isMessage } from '../shared/messages';
import { createTabState } from '../shared/types';
import { clearBadge, setBadge } from './badge';
import { setAllowlisted } from './settings';
import { clearTabState, getTabState, patchTabState, setTabState } from './tab-state';

const UNKNOWN_VERDICT: Verdict = {
  level: 'UNKNOWN',
  score: 0,
  reasons: [],
  engine: 'heuristic',
  extractorVersion: EXTRACTOR_VERSION,
};

function isScorable(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0 || !isScorable(details.url)) return;
  console.log('[sentinel] onBeforeNavigate', details.url);
  void (async () => {
    await setTabState(createTabState(details.tabId, details.url, EXTRACTOR_VERSION));
    await setBadge(details.tabId, 'UNKNOWN');
  })();
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  console.log('[sentinel] onCommitted', details.url);
});

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return;
  console.log('[sentinel] onCompleted', details.url);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  console.log('[sentinel] onRemoved', tabId);
  void (async () => {
    await clearTabState(tabId);
    await clearBadge(tabId);
  })();
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  void handleMessage(message, sender).then(sendResponse);
  return true;
});

async function handleMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
): Promise<Record<string, unknown>> {
  if (!isMessage(message)) return { error: 'UNKNOWN_MESSAGE' };

  switch (message.type) {
    case 'GET_TAB_STATE': {
      const tabId = message.payload.tabId ?? sender.tab?.id;
      if (tabId === undefined) return { state: null };
      return { state: await getTabState(tabId) };
    }
    case 'SCORE_REQUEST':
      return { verdict: UNKNOWN_VERDICT };
    case 'SET_ALLOWLIST':
      return { allowlist: await setAllowlisted(message.payload.etld1, message.payload.allow) };
    case 'PROCEED': {
      const tabId = message.payload.tabId ?? sender.tab?.id;
      if (tabId !== undefined) await patchTabState(tabId, { proceeded: true });
      return { ok: true };
    }
    case 'DISMISS': {
      const tabId = message.payload.tabId ?? sender.tab?.id;
      if (tabId !== undefined) await patchTabState(tabId, { dismissed: true });
      return { ok: true };
    }
    case 'CLOSE_TAB': {
      const tabId = message.payload.tabId ?? sender.tab?.id;
      if (tabId !== undefined) await chrome.tabs.remove(tabId);
      return { ok: true };
    }
    case 'SCORE_RESULT':
      return { ok: true };
    case 'MANUAL_CHECK':
    case 'DEEP_SCAN':
      return { verdict: UNKNOWN_VERDICT };
  }
}

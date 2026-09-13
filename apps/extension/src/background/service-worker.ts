import { EXTRACTOR_VERSION, extractStage1 } from '@sentinel/features';
import type { Verdict } from '@sentinel/heuristics';

import { isMessage } from '../shared/messages';
import { createTabState } from '../shared/types';
import { clearBadge, setBadge } from './badge';
import { heuristicEngine } from './engine';
import { mergeVerdicts, scoreFeatures } from './scoring';
import { setAllowlisted, updateSettings } from './settings';
import { cachedSettings, initSettingsCache } from './settings-cache';
import { clearTabState, getTabState, patchTabState, setTabState } from './tab-state';

const STAGE2_TIMEOUT_MS = 1500;
const stage2Timers = new Map<number, ReturnType<typeof setTimeout>>();

void initSettingsCache();

function isScorable(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

function unknownVerdict(): Verdict {
  return {
    level: 'UNKNOWN',
    score: 0,
    reasons: [],
    engine: 'heuristic',
    extractorVersion: EXTRACTOR_VERSION,
  };
}

function clearStage2Timer(tabId: number): void {
  const timer = stage2Timers.get(tabId);
  if (timer !== undefined) {
    clearTimeout(timer);
    stage2Timers.delete(tabId);
  }
}

async function runStage1(tabId: number, url: string): Promise<void> {
  const settings = cachedSettings();
  if (!settings.enabled) {
    await setBadge(tabId, 'UNKNOWN');
    return;
  }

  const start = performance.now();
  const features = extractStage1(url);
  if (features === null) return;

  const verdict = scoreFeatures(heuristicEngine, url, features, settings);
  const elapsed = performance.now() - start;

  const state = createTabState(tabId, url, EXTRACTOR_VERSION);
  state.stage1 = verdict;
  state.final = verdict;
  state.timings.stage1Ms = elapsed;

  const existing = await getTabState(tabId);
  if (existing?.url === url) {
    state.dismissed = existing.dismissed;
    state.proceeded = existing.proceeded;
  }

  await setTabState(state);
  await setBadge(tabId, verdict.level);
}

async function finalizeOnTimeout(tabId: number): Promise<void> {
  stage2Timers.delete(tabId);
  const state = await getTabState(tabId);
  if (state?.stage2 !== null) return;

  const final = state.stage1 ?? unknownVerdict();
  await patchTabState(tabId, { final });
  await setBadge(tabId, final.level);
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0 || !isScorable(details.url)) return;
  clearStage2Timer(details.tabId);
  void runStage1(details.tabId, details.url);
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  console.log('[sentinel] onCommitted', details.url);
});

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0 || !isScorable(details.url)) return;
  clearStage2Timer(details.tabId);
  const timer = setTimeout(() => {
    void finalizeOnTimeout(details.tabId);
  }, STAGE2_TIMEOUT_MS);
  stage2Timers.set(details.tabId, timer);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearStage2Timer(tabId);
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
    case 'GET_SETTINGS':
      return { settings: cachedSettings() };
    case 'SET_ENABLED': {
      const settings = await updateSettings({ enabled: message.payload.enabled });
      const tabId = sender.tab?.id;
      if (tabId !== undefined && !settings.enabled) {
        await setBadge(tabId, 'UNKNOWN');
      }
      return { settings };
    }
    case 'MANUAL_CHECK': {
      const { url } = message.payload;
      const settings = cachedSettings();
      const features = extractStage1(url);
      if (features === null) return { verdict: unknownVerdict() };
      return { verdict: scoreFeatures(heuristicEngine, url, features, settings) };
    }
    case 'SCORE_REQUEST': {
      const tabId = sender.tab?.id;
      const settings = cachedSettings();
      if (!settings.enabled) return { verdict: unknownVerdict() };

      const { url, features } = message.payload;
      const stage2 = scoreFeatures(heuristicEngine, url, Float32Array.from(features), settings);

      const current = tabId === undefined ? null : await getTabState(tabId);
      const final = mergeVerdicts(current?.stage1 ?? null, stage2) ?? stage2;

      if (tabId !== undefined) {
        clearStage2Timer(tabId);
        const next = current ?? createTabState(tabId, url, EXTRACTOR_VERSION);
        const timings = { ...next.timings };
        if (message.payload.extractionMs !== undefined) {
          timings.stage2Ms = message.payload.extractionMs;
        }
        await setTabState({ ...next, url, stage2, final, timings });
        await setBadge(tabId, final.level);
      }
      return { verdict: final };
    }
    case 'SET_ALLOWLIST': {
      const allowlist = await setAllowlisted(message.payload.etld1, message.payload.allow);
      const tabId = sender.tab?.id;
      if (tabId !== undefined && message.payload.allow) {
        await setBadge(tabId, 'LOW');
      }
      return { allowlist };
    }
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
    case 'DEEP_SCAN':
      return { verdict: unknownVerdict() };
  }
}

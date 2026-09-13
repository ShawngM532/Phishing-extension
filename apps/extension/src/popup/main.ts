import { parseUrl } from '@sentinel/features';
import type { Verdict } from '@sentinel/heuristics';

import type { Settings } from '../background/settings';
import { sendMessage } from '../shared/messages';
import type { TabState } from '../shared/types';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function tabIdFromQuery(): number | undefined {
  const value = new URLSearchParams(location.search).get('tabId');
  if (value === null) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

async function resolveTabId(): Promise<number | undefined> {
  const fromQuery = tabIdFromQuery();
  if (fromQuery !== undefined) return fromQuery;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

function renderReasons(verdict: Verdict): HTMLElement {
  const list = el('ul', 'reasons');
  for (const reason of verdict.reasons.slice(0, 5)) {
    list.append(el('li', 'reasons__item', reason.humanText));
  }
  return list;
}

function renderVerdictCard(state: TabState | null): HTMLElement {
  const card = el('div', 'card');
  const verdict = state?.final ?? null;

  if (verdict === null) {
    card.append(el('p', 'popup__placeholder', 'No verdict yet.'));
    return card;
  }

  card.classList.add(`card--${verdict.level.toLowerCase()}`);
  const header = el('div', 'card__row');
  header.append(
    el('span', 'card__level', verdict.level),
    el('span', 'card__score', `${String(Math.round(verdict.score * 100))}%`),
  );
  card.append(header);
  card.append(renderReasons(verdict));
  return card;
}

function renderFooter(state: TabState | null): string {
  if (state === null) return '';
  const parts = [`Engine: ${state.final?.engine ?? 'none'}`];
  if (state.modelVersion !== null) parts.push(`Model v${String(state.modelVersion)}`);
  parts.push(`Extractor v${String(state.extractorVersion)}`);
  if (state.timings.stage1Ms !== undefined) {
    parts.push(`URL scan ${state.timings.stage1Ms.toFixed(1)} ms`);
  }
  return parts.join(' · ');
}

function normaliseUrl(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function renderQuickResult(container: HTMLElement, verdict: Verdict): void {
  container.replaceChildren();
  container.append(
    el('span', `quick__level quick__level--${verdict.level.toLowerCase()}`, verdict.level),
    el('span', 'quick__reason', verdict.reasons[0]?.humanText ?? 'No strong signals found.'),
  );
}

async function main(): Promise<void> {
  const tabId = await resolveTabId();
  const stateResponse =
    tabId === undefined
      ? { state: null }
      : await sendMessage({ type: 'GET_TAB_STATE', payload: { tabId } });
  const state = stateResponse.state;

  const settingsResponse = await sendMessage({ type: 'GET_SETTINGS', payload: {} });
  const settings: Settings = settingsResponse.settings;

  const verdictContainer = document.getElementById('verdict');
  if (verdictContainer) {
    verdictContainer.replaceChildren(renderVerdictCard(state));
  }

  const footer = document.getElementById('footer');
  if (footer) footer.textContent = renderFooter(state);

  const toggle = document.getElementById('global-toggle');
  if (toggle instanceof HTMLInputElement) {
    toggle.checked = settings.enabled;
    toggle.addEventListener('change', () => {
      void sendMessage({ type: 'SET_ENABLED', payload: { enabled: toggle.checked } });
    });
  }

  const etld1 = state === null ? null : (parseUrl(state.url)?.etld1 ?? null);
  const allowlistToggle = document.getElementById('allowlist-toggle');
  if (allowlistToggle instanceof HTMLInputElement) {
    allowlistToggle.disabled = etld1 === null;
    allowlistToggle.checked = etld1 !== null && settings.allowlist.includes(etld1);
    allowlistToggle.addEventListener('change', () => {
      if (etld1 === null) return;
      void sendMessage({
        type: 'SET_ALLOWLIST',
        payload: { etld1, allow: allowlistToggle.checked },
      });
    });
  }

  const input = document.getElementById('check-url');
  const result = document.getElementById('check-result');
  const checkButton = document.getElementById('check-button');
  if (input instanceof HTMLInputElement && checkButton instanceof HTMLButtonElement) {
    checkButton.addEventListener('click', () => {
      const url = normaliseUrl(input.value);
      if (result === null) return;
      result.replaceChildren();
      if (url === null) {
        result.textContent = 'Enter a valid http(s) link.';
        return;
      }
      void sendMessage({ type: 'MANUAL_CHECK', payload: { url } }).then((response) => {
        renderQuickResult(result, response.verdict);
      });
    });
  }
}

void main();

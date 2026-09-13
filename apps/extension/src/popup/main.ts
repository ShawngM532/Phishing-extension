import { sendMessage } from '../shared/messages';
import type { TabState } from '../shared/types';

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

function render(state: TabState | null): void {
  const verdictEl = document.getElementById('verdict');
  const footerEl = document.getElementById('footer');
  if (!verdictEl) return;

  verdictEl.replaceChildren();

  if (state === null) {
    const placeholder = document.createElement('p');
    placeholder.className = 'popup__placeholder';
    placeholder.textContent = 'No verdict yet.';
    verdictEl.append(placeholder);
  } else {
    const url = document.createElement('p');
    url.className = 'popup__url';
    url.textContent = state.url;
    verdictEl.append(url);

    const level = document.createElement('p');
    level.className = `popup__level popup__level--${(state.final?.level ?? 'UNKNOWN').toLowerCase()}`;
    level.textContent = state.final?.level ?? 'No verdict yet';
    verdictEl.append(level);
  }

  if (footerEl) {
    const parts = state ? [`Extractor v${String(state.extractorVersion)}`] : [];
    if (state && state.modelVersion !== null) {
      parts.push(`Model v${String(state.modelVersion)}`);
    }
    footerEl.textContent = parts.join(' · ');
  }
}

async function main(): Promise<void> {
  const tabId = await resolveTabId();
  if (tabId === undefined) {
    render(null);
    return;
  }
  const { state } = await sendMessage({ type: 'GET_TAB_STATE', payload: { tabId } });
  render(state);
}

void main();

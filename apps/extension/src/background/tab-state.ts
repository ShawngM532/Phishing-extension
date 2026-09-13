import type { TabState } from '../shared/types';

const KEY_PREFIX = 'tab:';

function keyFor(tabId: number): string {
  return `${KEY_PREFIX}${String(tabId)}`;
}

function isTabState(value: unknown): value is TabState {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<TabState>;
  return typeof candidate.tabId === 'number' && typeof candidate.url === 'string';
}

export async function getTabState(tabId: number): Promise<TabState | null> {
  const key = keyFor(tabId);
  const stored = await chrome.storage.session.get(key);
  const value: unknown = stored[key];
  return isTabState(value) ? value : null;
}

export async function setTabState(state: TabState): Promise<void> {
  await chrome.storage.session.set({ [keyFor(state.tabId)]: state });
}

export async function patchTabState(
  tabId: number,
  patch: Partial<TabState>,
): Promise<TabState | null> {
  const current = await getTabState(tabId);
  if (current === null) return null;
  const next: TabState = {
    ...current,
    ...patch,
    tabId: current.tabId,
    url: patch.url ?? current.url,
  };
  await setTabState(next);
  return next;
}

export async function clearTabState(tabId: number): Promise<void> {
  await chrome.storage.session.remove(keyFor(tabId));
}

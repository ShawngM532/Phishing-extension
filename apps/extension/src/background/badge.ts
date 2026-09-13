import type { VerdictLevel } from '@sentinel/heuristics';

type IconColor = 'green' | 'amber' | 'red' | 'grey';

const ICON_FOR_LEVEL: Record<VerdictLevel, IconColor> = {
  LOW: 'green',
  MEDIUM: 'amber',
  HIGH: 'red',
  UNKNOWN: 'grey',
};

const BADGE_BACKGROUND: Record<VerdictLevel, string> = {
  LOW: '#16a34a',
  MEDIUM: '#f59e0b',
  HIGH: '#dc2626',
  UNKNOWN: '#9ca3af',
};

function iconPath(color: IconColor): Record<number, string> {
  return {
    16: `icons/${color}-16.png`,
    32: `icons/${color}-32.png`,
    48: `icons/${color}-48.png`,
    128: `icons/${color}-128.png`,
  };
}

export async function setBadge(tabId: number, level: VerdictLevel): Promise<void> {
  const color = ICON_FOR_LEVEL[level];
  await chrome.action.setIcon({ tabId, path: iconPath(color) });
  await chrome.action.setBadgeText({ tabId, text: level === 'LOW' ? '' : '!' });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_BACKGROUND[level] });
}

export async function clearBadge(tabId: number): Promise<void> {
  await chrome.action.setBadgeText({ tabId, text: '' });
  await chrome.action.setIcon({ tabId, path: iconPath('grey') });
}

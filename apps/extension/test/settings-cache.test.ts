import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '../src/background/settings';
import { installChromeMock, type ChromeMockHandle } from './chrome-mock';

const CUSTOM = {
  enabled: false,
  allowlist: ['xero.com'],
  thresholds: { medium: 0.4, high: 0.8 },
};

const UPDATED = {
  enabled: true,
  allowlist: ['a.com'],
  thresholds: { medium: 0.3, high: 0.7 },
};

describe('settings cache', () => {
  let handle: ChromeMockHandle;

  beforeEach(() => {
    handle = installChromeMock();
    vi.resetModules();
  });

  it('starts with defaults and can be overwritten', async () => {
    const cache = await import('../src/background/settings-cache');
    cache.setCachedSettings(CUSTOM);
    expect(cache.cachedSettings()).toEqual(CUSTOM);

    cache.setCachedSettings(DEFAULT_SETTINGS);
    expect(cache.cachedSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('loads from storage and follows changes', async () => {
    handle.sync.store.set('settings', CUSTOM);
    const cache = await import('../src/background/settings-cache');

    await cache.initSettingsCache();
    expect(cache.cachedSettings()).toEqual(CUSTOM);

    handle.emitChange({ settings: { newValue: UPDATED } }, 'sync');
    expect(cache.cachedSettings()).toEqual(UPDATED);
  });

  it('settingsReady resolves after the cache loads', async () => {
    handle.sync.store.set('settings', CUSTOM);
    const cache = await import('../src/background/settings-cache');

    await cache.settingsReady();
    expect(cache.cachedSettings()).toEqual(CUSTOM);
  });
});

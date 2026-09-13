import { describe, expect, it } from 'vitest';

import {
  cachedSettings,
  initSettingsCache,
  setCachedSettings,
} from '../src/background/settings-cache';
import { DEFAULT_SETTINGS } from '../src/background/settings';
import { installChromeMock } from './chrome-mock';

describe('settings cache', () => {
  it('starts with defaults and can be overwritten', () => {
    installChromeMock();
    const custom = {
      enabled: false,
      allowlist: ['xero.com'],
      thresholds: { medium: 0.4, high: 0.8 },
    };
    setCachedSettings(custom);
    expect(cachedSettings()).toEqual(custom);
    setCachedSettings(DEFAULT_SETTINGS);
  });

  it('loads from storage and follows changes', async () => {
    const handle = installChromeMock();
    handle.sync.store.set('settings', {
      enabled: false,
      allowlist: [],
      thresholds: { medium: 0.3, high: 0.7 },
    });
    await initSettingsCache();
    expect(cachedSettings().enabled).toBe(false);

    const updated = { enabled: true, allowlist: ['a.com'], thresholds: { medium: 0.3, high: 0.7 } };
    handle.emitChange({ settings: { newValue: updated } }, 'sync');
    expect(cachedSettings()).toEqual(updated);
  });
});

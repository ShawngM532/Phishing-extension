import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_SETTINGS,
  getSettings,
  onSettingsChanged,
  setAllowlisted,
  setSettings,
  updateSettings,
} from '../src/background/settings';
import { installChromeMock, type ChromeMockHandle } from './chrome-mock';

describe('settings store', () => {
  let handle: ChromeMockHandle;

  beforeEach(() => {
    handle = installChromeMock();
  });

  it('returns defaults when storage is empty', async () => {
    await expect(getSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips valid settings', async () => {
    const settings = {
      enabled: false,
      allowlist: ['xero.com'],
      thresholds: { medium: 0.4, high: 0.8 },
    };
    await setSettings(settings);
    await expect(getSettings()).resolves.toEqual(settings);
  });

  it('resets corrupt settings to defaults and warns only once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    handle.sync.store.set('settings', { enabled: 'yes' });

    await expect(getSettings()).resolves.toEqual(DEFAULT_SETTINGS);
    await expect(getSettings()).resolves.toEqual(DEFAULT_SETTINGS);

    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('updates the allowlist immutably and sorts it', async () => {
    await expect(setAllowlisted('xero.com', true)).resolves.toEqual(['xero.com']);
    await setAllowlisted('myob.com', true);
    await expect(setAllowlisted('xero.com', false)).resolves.toEqual(['myob.com']);
  });

  it('applies partial updates', async () => {
    await updateSettings({ enabled: false });
    const settings = await getSettings();
    expect(settings.enabled).toBe(false);
    expect(settings.thresholds).toEqual(DEFAULT_SETTINGS.thresholds);
  });

  it('notifies listeners about valid sync changes only', () => {
    const listener = vi.fn();
    onSettingsChanged(listener);

    handle.emitChange({ settings: { newValue: DEFAULT_SETTINGS } }, 'sync');
    handle.emitChange({ settings: { newValue: { broken: true } } }, 'sync');
    handle.emitChange({ other: { newValue: 1 } }, 'local');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(DEFAULT_SETTINGS);
  });
});

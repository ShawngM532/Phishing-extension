import { DEFAULT_SETTINGS, getSettings, onSettingsChanged, type Settings } from './settings';

let cache: Settings = structuredClone(DEFAULT_SETTINGS);
let initPromise: Promise<void> | null = null;

/** Loads settings into memory (once) and keeps them fresh via storage.onChanged. */
export function initSettingsCache(): Promise<void> {
  initPromise ??= (async () => {
    cache = await getSettings();
    onSettingsChanged((settings) => {
      cache = settings;
    });
  })();
  return initPromise;
}

/** Resolves once the cache has been loaded from storage at least once. */
export function settingsReady(): Promise<void> {
  return initPromise ?? initSettingsCache();
}

export function cachedSettings(): Settings {
  return cache;
}

/** Test helper: overwrite the cache without touching storage. */
export function setCachedSettings(settings: Settings): void {
  cache = settings;
}

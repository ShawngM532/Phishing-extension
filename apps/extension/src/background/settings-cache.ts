import { DEFAULT_SETTINGS, getSettings, onSettingsChanged, type Settings } from './settings';

let cache: Settings = structuredClone(DEFAULT_SETTINGS);

/** Loads settings into memory and keeps them fresh via storage.onChanged. */
export async function initSettingsCache(): Promise<void> {
  cache = await getSettings();
  onSettingsChanged((settings) => {
    cache = settings;
  });
}

export function cachedSettings(): Settings {
  return cache;
}

/** Test helper: overwrite the cache without touching storage. */
export function setCachedSettings(settings: Settings): void {
  cache = settings;
}

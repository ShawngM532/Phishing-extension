import { z } from 'zod';

export const ThresholdsSchema = z.object({
  medium: z.number().min(0).max(1),
  high: z.number().min(0).max(1),
});

export const SettingsSchema = z.object({
  enabled: z.boolean(),
  allowlist: z.array(z.string()),
  thresholds: ThresholdsSchema,
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  allowlist: [],
  thresholds: { medium: 0.35, high: 0.75 },
};

const STORAGE_KEY = 'settings';
let warnedAboutCorruption = false;

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  const raw: unknown = stored[STORAGE_KEY];

  if (raw === undefined) {
    return structuredClone(DEFAULT_SETTINGS);
  }

  const parsed = SettingsSchema.safeParse(raw);
  if (!parsed.success) {
    if (!warnedAboutCorruption) {
      console.warn('[sentinel] stored settings were invalid; resetting to defaults');
      warnedAboutCorruption = true;
    }
    await chrome.storage.sync.set({ [STORAGE_KEY]: DEFAULT_SETTINGS });
    return structuredClone(DEFAULT_SETTINGS);
  }

  return parsed.data;
}

export async function setSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next: Settings = { ...current, ...patch };
  await setSettings(next);
  return next;
}

export async function setAllowlisted(etld1: string, allow: boolean): Promise<string[]> {
  const current = await getSettings();
  const set = new Set(current.allowlist);
  if (allow) {
    set.add(etld1);
  } else {
    set.delete(etld1);
  }
  const allowlist = [...set].sort();
  await updateSettings({ allowlist });
  return allowlist;
}

export function onSettingsChanged(listener: (settings: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !(STORAGE_KEY in changes)) return;
    const parsed = SettingsSchema.safeParse(changes[STORAGE_KEY].newValue);
    if (parsed.success) listener(parsed.data);
  });
}

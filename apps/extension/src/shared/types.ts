import type { Verdict } from '@sentinel/heuristics';

export interface TabTimings {
  stage1Ms?: number;
  stage2Ms?: number;
}

/** Per-tab scoring state, persisted in chrome.storage.session so it survives SW restarts. */
export interface TabState {
  tabId: number;
  url: string;
  stage1: Verdict | null;
  stage2: Verdict | null;
  final: Verdict | null;
  proceeded: boolean;
  dismissed: boolean;
  extractorVersion: number;
  modelVersion: number | null;
  timings: TabTimings;
}

export function createTabState(tabId: number, url: string, extractorVersion: number): TabState {
  return {
    tabId,
    url,
    stage1: null,
    stage2: null,
    final: null,
    proceeded: false,
    dismissed: false,
    extractorVersion,
    modelVersion: null,
    timings: {},
  };
}

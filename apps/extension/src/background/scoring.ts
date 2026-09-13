import { EXTRACTOR_VERSION, parseUrl } from '@sentinel/features';
import type { Verdict } from '@sentinel/heuristics';

import type { Engine } from './engine';
import type { Settings } from './settings';

const LEVEL_RANK: Readonly<Record<Verdict['level'], number>> = {
  UNKNOWN: -1,
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

export function isAllowlisted(url: string, settings: Settings): boolean {
  const etld1 = parseUrl(url)?.etld1 ?? null;
  return etld1 !== null && settings.allowlist.includes(etld1);
}

export function scoreFeatures(
  engine: Engine,
  url: string,
  features: Float32Array,
  settings: Settings,
): Verdict {
  return engine.score({
    url,
    features,
    extractorVersion: EXTRACTOR_VERSION,
    thresholds: settings.thresholds,
    allowlisted: isAllowlisted(url, settings),
  });
}

/**
 * Final verdict = the stronger of stage 1 and stage 2, with two exceptions:
 * a HIGH from stage 1 is never downgraded, and a confident clean DOM
 * (stage 2 score < 0.15) rescues a MEDIUM stage 1.
 */
export function mergeVerdicts(stage1: Verdict | null, stage2: Verdict | null): Verdict | null {
  if (stage1 === null) return stage2;
  if (stage2 === null) return stage1;

  if (stage1.level === 'HIGH') return stage1;
  if (stage2.score < 0.15 && stage1.level === 'MEDIUM') return stage2;

  return LEVEL_RANK[stage2.level] >= LEVEL_RANK[stage1.level] ? stage2 : stage1;
}

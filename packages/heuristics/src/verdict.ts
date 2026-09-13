import {
  DEFAULT_THRESHOLDS,
  type EngineName,
  type Reason,
  type Thresholds,
  type Verdict,
  type VerdictLevel,
} from './types';

const LEVEL_RANK: Readonly<Record<VerdictLevel, number>> = {
  UNKNOWN: -1,
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

export interface VerdictInput {
  score: number;
  reasons: Reason[];
  engine: EngineName;
  extractorVersion: number;
  modelVersion?: number;
  thresholds?: Thresholds;
  override?: VerdictLevel | null;
  allowlisted?: boolean;
}

export function levelForScore(
  score: number,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): VerdictLevel {
  if (score >= thresholds.high) return 'HIGH';
  if (score >= thresholds.medium) return 'MEDIUM';
  return 'LOW';
}

export function maxLevel(a: VerdictLevel, b: VerdictLevel): VerdictLevel {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

/**
 * Builds the final verdict. Allowlisting short-circuits to LOW; a hard override can only
 * raise the level, never lower it.
 */
export function toVerdict(input: VerdictInput): Verdict {
  const thresholds = input.thresholds ?? DEFAULT_THRESHOLDS;
  const base: Verdict = {
    level: levelForScore(input.score, thresholds),
    score: input.score,
    reasons: input.reasons,
    engine: input.engine,
    extractorVersion: input.extractorVersion,
    ...(input.modelVersion !== undefined ? { modelVersion: input.modelVersion } : {}),
  };

  if (input.allowlisted === true) {
    return {
      ...base,
      level: 'LOW',
      score: 0,
      reasons: [{ code: 'ALLOWLISTED', humanText: 'You marked this site as safe.', weight: 0 }],
    };
  }

  if (input.override !== null && input.override !== undefined) {
    return { ...base, level: maxLevel(base.level, input.override) };
  }

  return base;
}

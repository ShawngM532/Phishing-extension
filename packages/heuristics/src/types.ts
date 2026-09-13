/** Domain types shared by the scoring engine, the service worker and the UI. */

export type VerdictLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';

export type EngineName = 'heuristic' | 'model';

/** A single explanation attached to a verdict. `code` is a stable identifier. */
export interface Reason {
  code: string;
  humanText: string;
  weight: number;
}

/** LOW < medium ≤ MEDIUM < high ≤ HIGH. Config values, tuned on validation data. */
export interface Thresholds {
  medium: number;
  high: number;
}

export interface Verdict {
  level: VerdictLevel;
  score: number;
  reasons: Reason[];
  engine: EngineName;
  extractorVersion: number;
  modelVersion?: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = { medium: 0.35, high: 0.75 };

/** Extra context available to rules and reason copy beyond the raw feature vector. */
export interface ScoreContext {
  /** eTLD+1 of the page, or null when unknown. */
  etld1: string | null;
  /** Brand token the page appears to imitate, or null. */
  brandToken: string | null;
}

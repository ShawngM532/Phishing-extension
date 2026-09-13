import { parseUrl } from '@sentinel/features';
import {
  hardOverride,
  scoreHeuristic,
  toVerdict,
  type ScoreContext,
  type Thresholds,
  type Verdict,
} from '@sentinel/heuristics';

export interface ScoreInput {
  url: string;
  features: Float32Array | readonly number[];
  extractorVersion: number;
  thresholds?: Thresholds;
  allowlisted?: boolean;
}

/** Scoring backend. Phase 8 adds a WASM model engine behind the same interface. */
export interface Engine {
  readonly name: 'heuristic' | 'model';
  score(input: ScoreInput): Verdict;
}

function toFloat32(features: Float32Array | readonly number[]): Float32Array {
  return features instanceof Float32Array ? features : Float32Array.from(features);
}

export const heuristicEngine: Engine = {
  name: 'heuristic',
  score(input: ScoreInput): Verdict {
    const features = toFloat32(input.features);
    const parts = parseUrl(input.url);
    const ctx: ScoreContext = { etld1: parts?.etld1 ?? null, brandToken: null };

    const { score, reasons } = scoreHeuristic(features, ctx);
    const override = hardOverride(features);

    return toVerdict({
      score,
      reasons,
      engine: 'heuristic',
      extractorVersion: input.extractorVersion,
      override,
      ...(input.thresholds !== undefined ? { thresholds: input.thresholds } : {}),
      ...(input.allowlisted !== undefined ? { allowlisted: input.allowlisted } : {}),
    });
  },
};

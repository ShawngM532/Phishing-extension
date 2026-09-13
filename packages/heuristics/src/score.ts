import { RULES } from './rules';
import type { Reason, ScoreContext } from './types';

export interface HeuristicScore {
  score: number;
  reasons: Reason[];
}

/**
 * Noisy-OR over fired rule weights: score = 1 - Π(1 - w_i).
 * Monotonic (adding a fired rule never lowers the score) and saturating in [0, 1].
 */
export function scoreHeuristic(features: Float32Array, ctx: ScoreContext): HeuristicScore {
  const fired = RULES.filter((rule) => rule.test(features, ctx));

  let remaining = 1;
  for (const rule of fired) remaining *= 1 - rule.weight;

  const reasons = fired
    .map<Reason>((rule) => ({
      code: rule.code,
      humanText: rule.human(ctx),
      weight: rule.weight,
    }))
    .sort((a, b) => b.weight - a.weight);

  return { score: 1 - remaining, reasons };
}

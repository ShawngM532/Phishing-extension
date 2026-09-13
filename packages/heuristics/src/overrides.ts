import { FEATURE_INDEX } from '@sentinel/features';

import type { VerdictLevel } from './types';

/**
 * Hard overrides from PRD §10.4, applied after the model/heuristic score.
 * Returns the minimum level the page must be treated as, or null.
 */
export function hardOverride(features: Float32Array): VerdictLevel | null {
  const ipHost = features[FEATURE_INDEX.host_is_ip] === 1;
  const password = features[FEATURE_INDEX.has_password_input] === 1;
  const punycode = features[FEATURE_INDEX.has_punycode] === 1;
  const brandInSubdomain = features[FEATURE_INDEX.brand_in_subdomain] === 1;
  const lookalike = features[FEATURE_INDEX.brand_lookalike_host] ?? 1;
  const externalAction = features[FEATURE_INDEX.password_form_action_external] === 1;

  if (ipHost && password) return 'HIGH';
  if (punycode && brandInSubdomain) return 'HIGH';
  if (lookalike > 0 && lookalike < 0.15 && password) return 'HIGH';
  if (externalAction) return 'MEDIUM';

  return null;
}

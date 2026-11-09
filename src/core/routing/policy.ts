/**
 * The routing policy, in the same shape the plugin reads from
 * `policies/routing-policy.json` (a team policy) or its own
 * `plugin/config/routing-policy.json` (the default).
 *
 * The values below are the plugin's shipped default, copied verbatim so the dashboard
 * computes the same tier the CLI does when no team policy is connected. When a hub ships
 * its own policy, `loadPolicy` in `services/cli` replaces this object — the dashboard
 * never prefers its own copy over the hub's.
 */
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];

export const PHASES = ['plan', 'implement', 'verify', 'ask'] as const;
export type Phase = (typeof PHASES)[number];

export interface PhaseSetting {
  model: string;
  effort: Effort;
  advisor?: string;
}

export interface Tier {
  name: string;
  max_score: number;
  phases: Record<Phase, PhaseSetting>;
}

export interface RoutingPolicy {
  schema_version: number;
  modifiers: {
    codebase_size_large: number;
    test_maturity_low: number;
    touches_critical_paths: number;
    touches_legacy_paths: number;
  };
  tiers: Tier[];
  mechanical: { name: string; phases: Record<Phase, PhaseSetting> };
}

export const DEFAULT_POLICY: RoutingPolicy = {
  schema_version: 1,
  modifiers: {
    codebase_size_large: 1,
    test_maturity_low: 1,
    touches_critical_paths: 1,
    touches_legacy_paths: 1,
  },
  tiers: [
    {
      name: 'T1-routine',
      max_score: 4,
      phases: {
        plan: { model: 'sonnet', effort: 'medium' },
        implement: { model: 'sonnet', effort: 'medium' },
        verify: { model: 'sonnet', effort: 'medium' },
        ask: { model: 'sonnet', effort: 'low' },
      },
    },
    {
      name: 'T2-standard',
      max_score: 6,
      phases: {
        plan: { model: 'opus', effort: 'high' },
        implement: { model: 'sonnet', effort: 'high' },
        verify: { model: 'sonnet', effort: 'high' },
        ask: { model: 'sonnet', effort: 'low' },
      },
    },
    {
      name: 'T3-critical',
      max_score: 8,
      phases: {
        plan: { model: 'opus', effort: 'xhigh' },
        implement: { model: 'opus', effort: 'high' },
        verify: { model: 'opus', effort: 'high' },
        ask: { model: 'sonnet', effort: 'medium' },
      },
    },
    {
      name: 'T4-high-risk',
      max_score: 99,
      phases: {
        plan: { model: 'opus', effort: 'xhigh' },
        implement: { model: 'opus', effort: 'high', advisor: 'opus' },
        verify: { model: 'opus', effort: 'xhigh' },
        ask: { model: 'opus', effort: 'low' },
      },
    },
  ],
  mechanical: {
    name: 'T0-mechanical',
    phases: {
      plan: { model: 'sonnet', effort: 'low' },
      implement: { model: 'haiku', effort: 'medium' },
      verify: { model: 'sonnet', effort: 'medium' },
      ask: { model: 'haiku', effort: 'low' },
    },
  },
};

/**
 * Family ranking, as the plugin's `routing.MODEL_RANK` defines it. It is a project
 * assumption rather than a published ordering, and it is used conservatively: an
 * ambiguous advisor match is dropped, never proposed.
 */
export const MODEL_RANK: Record<string, number> = {
  haiku: 1,
  sonnet: 2,
  fable: 3,
  opus: 4,
};

/** `opusplan` plans with Opus and executes with Sonnet, so it ranks as Sonnet. */
export function modelFamily(model: string | undefined): string | null {
  if (!model) return null;
  const name = model.trim().toLowerCase();
  if (name === '' || name === 'default' || name === 'inherit') return null;
  if (name === 'opusplan') return 'sonnet';
  return name in MODEL_RANK ? name : null;
}

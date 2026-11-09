import type { Phase, PhaseSetting, RoutingPolicy, Tier } from './policy';
import { DEFAULT_POLICY, modelFamily, MODEL_RANK, PHASES } from './policy';

export type SignalLevel = 'low' | 'medium' | 'high';

export interface Signals {
  complexity: SignalLevel;
  risk: SignalLevel;
  ambiguity: SignalLevel;
  kind?: 'mechanical';
}

export interface RepoProfile {
  codebase_size?: 'small' | 'medium' | 'large';
  test_maturity?: 'low' | 'medium' | 'high';
  critical_paths?: string[];
  legacy_paths?: string[];
}

export interface RoleScope {
  allow: string[];
  deny: string[];
}

export interface RoutingInput {
  signals: Signals;
  roleSignals?: Partial<Signals>;
  profile?: RepoProfile;
  scope?: RoleScope;
  overrides?: Record<string, Partial<Record<Phase, Partial<PhaseSetting>>>>;
  role: string;
  taskId: string;
  title: string;
  policy?: RoutingPolicy;
}

export interface Modifier {
  key: 'codebase_size_large' | 'test_maturity_low' | 'touches_critical_paths' | 'touches_legacy_paths';
  weight: number;
}

export interface RoutingDecision {
  signals: Signals;
  base: number;
  modifiers: Modifier[];
  score: number;
  tier: string;
  phases: Record<Phase, PhaseSetting>;
  launch: string;
}

const LEVEL: Record<SignalLevel, number> = { low: 1, medium: 2, high: 3 };

/**
 * The static prefix of a glob: everything before the first wildcard. Two globs intersect
 * when one prefix is a directory prefix of the other, or when either is empty — the
 * conservative reading the plugin uses.
 */
export function staticPrefix(glob: string): string {
  const cut = glob.search(/[*?[]/);
  const head = cut === -1 ? glob : glob.slice(0, cut);
  const slash = head.lastIndexOf('/');
  return cut === -1 ? head : slash === -1 ? '' : head.slice(0, slash + 1);
}

export function globsIntersect(a: string[] = [], b: string[] = []): boolean {
  for (const left of a) {
    const lp = staticPrefix(left);
    for (const right of b) {
      const rp = staticPrefix(right);
      if (lp === '' || rp === '') return true;
      if (lp === rp) return true;
      if (lp.startsWith(rp) || rp.startsWith(lp)) return true;
    }
  }
  return false;
}

function mergeSignals(signals: Signals, roleSignals?: Partial<Signals>): Signals {
  return {
    complexity: roleSignals?.complexity ?? signals.complexity ?? 'medium',
    risk: roleSignals?.risk ?? signals.risk ?? 'medium',
    ambiguity: roleSignals?.ambiguity ?? signals.ambiguity ?? 'medium',
    kind: roleSignals?.kind ?? signals.kind,
  };
}

function tierForScore(policy: RoutingPolicy, score: number): Tier {
  const ordered = [...policy.tiers].sort((a, b) => a.max_score - b.max_score);
  for (const tier of ordered) {
    if (score <= tier.max_score) return tier;
  }
  return ordered[ordered.length - 1];
}

function applyOverrides(
  phases: Record<Phase, PhaseSetting>,
  overrides: RoutingInput['overrides'],
  role: string,
): Record<Phase, PhaseSetting> {
  if (!overrides) return phases;
  const merged = { ...phases };
  for (const key of ['*', role]) {
    const layer = overrides[key];
    if (!layer) continue;
    for (const phase of PHASES) {
      const patch = layer[phase];
      if (!patch) continue;
      merged[phase] = { ...merged[phase], ...patch };
    }
  }
  return merged;
}

/** POSIX and PowerShell safe single quoting for the `--name` argument. */
export function quoteForShell(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function launchCommand(
  phases: Record<Phase, PhaseSetting>,
  taskId: string,
  title: string,
): string {
  const plan = modelFamily(phases.plan.model);
  const implement = phases.implement;
  const implementFamily = modelFamily(implement.model);
  const model = plan === 'opus' && implementFamily === 'sonnet' ? 'opusplan' : implement.model;
  const parts = [`claude --model ${model}`, `--effort ${implement.effort}`];

  const advisorFamily = modelFamily(implement.advisor);
  const mainFamily = modelFamily(model);
  if (
    advisorFamily &&
    mainFamily &&
    mainFamily !== 'haiku' &&
    MODEL_RANK[advisorFamily] >= MODEL_RANK[mainFamily]
  ) {
    parts.push(`--advisor ${implement.advisor}`);
  }

  parts.push(`--name ${quoteForShell(`${taskId} ${title}`)}`);
  return parts.join(' ');
}

/**
 * The whole routing decision, computed the way the plugin's `routing.py` computes it:
 * signals merged per role, project modifiers added, score mapped to a tier, tier phases
 * overridden, then the launch command derived from the plan and implement phases.
 */
export function route(input: RoutingInput): RoutingDecision {
  const policy = input.policy ?? DEFAULT_POLICY;
  const signals = mergeSignals(input.signals, input.roleSignals);
  const base = LEVEL[signals.complexity] + LEVEL[signals.risk] + LEVEL[signals.ambiguity];

  const modifiers: Modifier[] = [];
  const profile = input.profile ?? {};
  if (profile.codebase_size === 'large') {
    modifiers.push({ key: 'codebase_size_large', weight: policy.modifiers.codebase_size_large });
  }
  if (profile.test_maturity === 'low') {
    modifiers.push({ key: 'test_maturity_low', weight: policy.modifiers.test_maturity_low });
  }
  if (globsIntersect(input.scope?.allow, profile.critical_paths)) {
    modifiers.push({ key: 'touches_critical_paths', weight: policy.modifiers.touches_critical_paths });
  }
  if (globsIntersect(input.scope?.allow, profile.legacy_paths)) {
    modifiers.push({ key: 'touches_legacy_paths', weight: policy.modifiers.touches_legacy_paths });
  }

  const score = base + modifiers.reduce((total, modifier) => total + modifier.weight, 0);
  const tier = signals.kind === 'mechanical' ? policy.mechanical : tierForScore(policy, score);
  const phases = applyOverrides(tier.phases, input.overrides, input.role);

  return {
    signals,
    base,
    modifiers,
    score: signals.kind === 'mechanical' ? score : score,
    tier: tier.name,
    phases,
    launch: launchCommand(phases, input.taskId, input.title),
  };
}

import type { GateStatus } from '@/core/status/status';

/** The nine task quality gates, in pipeline order. */
export const GATE_IDS = [
  'intake',
  'research',
  'validate',
  'publish',
  'pull',
  'plan',
  'implement',
  'verify',
  'ship',
] as const;

export type GateId = (typeof GATE_IDS)[number];

export const TRACK_IDS = ['research', 'delivery', 'ship'] as const;
export type TrackId = (typeof TRACK_IDS)[number];

export const PERSONAS = ['researcher', 'developer', 'ci'] as const;
export type Persona = (typeof PERSONAS)[number];

export interface GateDefinition {
  readonly id: GateId;
  /** 1-based position in the whole pipeline — the `G1`…`G9` of the brief. */
  readonly index: number;
  readonly track: TrackId;
  readonly owner: Persona;
  /** The deterministic commands this gate runs, shown in the UI verbatim. */
  readonly commands: readonly string[];
  /** Files this gate writes, for the artifacts pane. */
  readonly artifacts: readonly string[];
  /** The gate that must reach a terminal status before this one may start. */
  readonly requires: GateId | null;
  /** True when the gate is a long, conversational one rather than a command. */
  readonly conversational: boolean;
}

export const GATES: Record<GateId, GateDefinition> = {
  intake: {
    id: 'intake',
    index: 1,
    track: 'research',
    owner: 'researcher',
    commands: ['wizrelay hub new <ref> --roles <roles>'],
    artifacts: ['tasks/<id>-<slug>/task.json'],
    requires: null,
    conversational: false,
  },
  research: {
    id: 'research',
    index: 2,
    track: 'research',
    owner: 'researcher',
    commands: [],
    artifacts: ['research.md', 'scope.md', 'acceptance.md', 'decisions.md', 'contracts.md', 'roles/<role>.md'],
    requires: 'intake',
    conversational: true,
  },
  validate: {
    id: 'validate',
    index: 3,
    track: 'research',
    owner: 'researcher',
    commands: ['/wizrelay:hub-validate <ref>'],
    artifacts: ['.validation.md'],
    requires: 'research',
    conversational: true,
  },
  publish: {
    id: 'publish',
    index: 4,
    track: 'research',
    owner: 'researcher',
    commands: [
      'wizrelay hub publish-prep <ref> --summary "<line>"',
      'git add tasks/<folder> && git commit -m "publish <id> v<n>: <summary>"',
      'git push origin <branch>',
    ],
    artifacts: ['task.json', 'commit', 'tracker comment'],
    requires: 'validate',
    conversational: false,
  },
  pull: {
    id: 'pull',
    index: 5,
    track: 'delivery',
    owner: 'developer',
    commands: ['wizrelay pull <ref>'],
    artifacts: ['.wizrelay/tasks/<folder>/', '.lock.json'],
    requires: 'publish',
    conversational: false,
  },
  plan: {
    id: 'plan',
    index: 6,
    track: 'delivery',
    owner: 'developer',
    commands: ['wizrelay brief --phase plan'],
    artifacts: ['plan.md'],
    requires: 'pull',
    conversational: true,
  },
  implement: {
    id: 'implement',
    index: 7,
    track: 'delivery',
    owner: 'developer',
    commands: ['wizrelay brief --phase implement'],
    artifacts: ['source diffs', 'plan.md'],
    requires: 'plan',
    conversational: true,
  },
  verify: {
    id: 'verify',
    index: 8,
    track: 'delivery',
    owner: 'developer',
    commands: ['wizrelay brief --phase verify', 'wizrelay audit --no-fail --format md'],
    artifacts: ['verification.md'],
    requires: 'implement',
    conversational: true,
  },
  ship: {
    id: 'ship',
    index: 9,

    track: 'delivery',
    owner: 'developer',
    commands: [
      'git commit -m "<message>"',
      'git push origin <branch>',
      'wizrelay audit --branch <branch> --base <base>',
    ],
    artifacts: ['commit', 'branch', 'pull request'],
    requires: 'verify',
    conversational: false,
  },
};

export const GATE_LIST: readonly GateDefinition[] = GATE_IDS.map((id) => GATES[id]);

export function gatesOfTrack(track: TrackId): readonly GateDefinition[] {
  return GATE_LIST.filter((gate) => gate.track === track);
}

/** Research runs once per relay; delivery and ship run once per role. */
export function isFannedOut(gate: GateDefinition): boolean {
  return gate.track !== 'research';
}

export function gateLabelKey(id: GateId): string {
  return `gate.${id}`;
}

/**
 * The status a gate that has not run yet should show: `blocked` while the gate it
 * depends on has not finished, `idle` once it could start.
 */
export function pendingStatus(gate: GateDefinition, statusOf: (id: GateId) => GateStatus): GateStatus {
  if (!gate.requires) return 'idle';
  const previous = statusOf(gate.requires);
  return previous === 'passed' || previous === 'warned' || previous === 'skipped' ? 'idle' : 'blocked';
}

export function nextGate(id: GateId): GateId | null {
  const index = GATE_IDS.indexOf(id);
  const next = GATE_IDS[index + 1];
  return next ?? null;
}

export function isGateId(value: string): value is GateId {
  return (GATE_IDS as readonly string[]).includes(value);
}

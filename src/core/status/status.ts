/**
 * The ten statuses of the brief's status model (§5). Nine belong to a gate; `guard-off`
 * is a session-wide warning and never a gate status, so it lives in its own type.
 *
 * Order matters: `STATUS_SORT` is the order the board must show, which is the order a
 * person can act on — what waits for them first, what broke second.
 */
export const GATE_STATUSES = [
  'waiting',
  'failed',
  'handoff',
  'running',
  'warned',
  'passed',
  'idle',
  'blocked',
  'skipped',
] as const;

export type GateStatus = (typeof GATE_STATUSES)[number];

/** Lower sorts first. */
const STATUS_SORT: Record<GateStatus, number> = {
  waiting: 0,
  failed: 1,
  handoff: 2,
  running: 3,
  warned: 4,
  passed: 5,
  idle: 6,
  blocked: 7,
  skipped: 8,
};

export function isGateStatus(value: string): value is GateStatus {
  return (GATE_STATUSES as readonly string[]).includes(value);
}

export function statusRank(status: GateStatus): number {
  return STATUS_SORT[status];
}

/** A status that needs the person who is looking at the screen. */
export function needsYou(status: GateStatus): boolean {
  return status === 'waiting';
}

/** A status that is finished, whatever the verdict. */
export function isTerminal(status: GateStatus): boolean {
  return status === 'passed' || status === 'warned' || status === 'failed' || status === 'skipped';
}

export function isActive(status: GateStatus): boolean {
  return status === 'running' || status === 'waiting' || status === 'handoff';
}

/** The CSS class the design system uses for this status (`.s-waiting`, …). */
export function statusClass(status: GateStatus): string {
  return `s-${status}`;
}

/** The verdict a finished gate reports, in the plugin's own words. */
export const VERDICTS = ['PASS', 'PARTIAL', 'FAIL'] as const;
export type Verdict = (typeof VERDICTS)[number];

export function verdictToStatus(verdict: Verdict): GateStatus {
  if (verdict === 'PASS') return 'passed';
  if (verdict === 'PARTIAL') return 'warned';
  return 'failed';
}

/** A criterion result, as `verification.md` writes it. */
export const CRITERION_RESULTS = ['PASS', 'FAIL', 'NOT COVERED'] as const;
export type CriterionResult = (typeof CRITERION_RESULTS)[number];

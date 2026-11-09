import type { GateId } from '@/core/gates/gates';
import { GATE_IDS, GATES, GATE_LIST, pendingStatus } from '@/core/gates/gates';
import type { GateStatus } from '@/core/status/status';
import { isTerminal, statusRank } from '@/core/status/status';
import type { GateState, NeedsYouItem, Relay, RelaySummary, Track } from './types';

export function emptyGateState(gate: GateId): GateState {
  return { gate, status: 'idle', checks: [], prompts: [], artifacts: [] };
}

/** A full nine-gate state list for a track, filling in what has not run. */
export function fillTrack(states: GateState[], trackGates: readonly GateId[]): GateState[] {
  const byId = new Map(states.map((state) => [state.gate, state]));
  const statusOf = (id: GateId): GateStatus => byId.get(id)?.status ?? 'idle';
  return trackGates.map((id) => {
    const existing = byId.get(id);
    if (existing) return existing;
    const state = emptyGateState(id);
    state.status = pendingStatus(GATES[id], statusOf);
    return state;
  });
}

/**
 * Reopen a gate whose requirement has since been met.
 *
 * A relay is created with every gate after the first written as `blocked`, and
 * `fillTrack` only computes a status for gates that have none — so once those rows
 * existed, nothing ever recomputed them. Intake would pass and research would sit there
 * saying it was blocked until intake passed.
 *
 * Only gates that have not started are touched. A gate that ran keeps its verdict,
 * because a result is a fact about something that happened and not a position in a
 * sequence.
 */
export function syncBlocked(states: GateState[], trackGates: readonly GateId[]): GateState[] {
  const byId = new Map(states.map((state) => [state.gate, state]));
  const statusOf = (id: GateId): GateStatus => byId.get(id)?.status ?? 'idle';

  return states.map((state) => {
    if (state.status !== 'blocked' && state.status !== 'idle') return state;
    if (!trackGates.includes(state.gate)) return state;

    const wanted = pendingStatus(GATES[state.gate], statusOf);
    return wanted === state.status ? state : { ...state, status: wanted };
  });
}

/**
 * Throw away what the gates after this one decided.
 *
 * A gate's verdict is about the work in front of it. Re-run research and the validation
 * that passed yesterday passed a package that no longer exists — but it goes on saying
 * `passed`, and the one screen somebody checks before publishing says the package was
 * reviewed. That is not a stale number; it is a wrong answer about whether work was
 * checked.
 *
 * So a gate starting resets everything downstream of it, in both tracks: the research
 * gates run in order, and the delivery gates each depend on `publish`. A developer's
 * finished `implement` is reset too, which sounds harsh and is the point — their plan was
 * built against a package that has since changed, and the relay exists to make that
 * visible rather than to let it pass.
 *
 * The code they wrote is untouched. What is reset is this panel's record of a gate having
 * been run, and the console transcript stays in the event log either way.
 */
export function invalidateAfter(relay: Relay, gate: GateId): Relay {
  const from = GATE_IDS.indexOf(gate);
  if (from < 0) return relay;

  let changed = false;
  const tracks = relay.tracks.map((track) => {
    const gates = track.gates.map((state) => {
      if (GATE_IDS.indexOf(state.gate) <= from) return state;
      if (state.status === 'blocked' || state.status === 'idle') return state;
      changed = true;
      return { ...emptyGateState(state.gate), supersededAt: new Date().toISOString() };
    });
    return changed ? { ...track, gates } : track;
  });

  if (!changed) return relay;
  return unblockRelay({ ...relay, tracks });
}

/** Every track of a relay, with the gates that may now run reopened. */
export function unblockRelay(relay: Relay): Relay {
  return {
    ...relay,
    tracks: relay.tracks.map((track) => ({
      ...track,
      gates: syncBlocked(track.gates, track.gates.map((state) => state.gate)),
    })),
  };
}

export function allGateStates(relay: Relay): GateState[] {
  return relay.tracks.flatMap((track) => track.gates);
}

/**
 * The status that represents the whole relay.
 *
 * What needs a person comes first; when nothing does, a relay is only `passed` once every
 * gate has finished. A published package nobody has pulled yet is not a finished relay,
 * so it reports the state of the gate it is actually sitting at.
 */
export function relayStatus(relay: Relay): GateStatus {
  const states = allGateStates(relay);
  if (states.length === 0) return 'idle';

  for (const status of ['waiting', 'failed', 'handoff', 'running'] as const) {
    if (states.some((state) => state.status === status)) return status;
  }

  if (states.every((state) => isTerminal(state.status))) {
    if (states.some((state) => state.status === 'warned')) return 'warned';
    return 'passed';
  }

  const current = currentGate(relay);
  const pending = states.find((state) => state.gate === current && !isTerminal(state.status));
  return pending?.status ?? 'idle';
}

/** The gate a person would look at first: what waits, else what runs, else what is next. */
export function currentGate(relay: Relay): GateId {
  const states = allGateStates(relay);
  const waiting = states.find((state) => state.status === 'waiting');
  if (waiting) return waiting.gate;
  const active = states.find((state) => state.status === 'running' || state.status === 'handoff');
  if (active) return active.gate;
  const failed = states.find((state) => state.status === 'failed');
  if (failed) return failed.gate;
  for (const id of GATE_IDS) {
    const matching = states.filter((state) => state.gate === id);
    if (matching.length === 0) return id;
    if (matching.some((state) => !isTerminal(state.status))) return id;
  }
  return 'ship';
}

export function openPrompts(relay: Relay): NeedsYouItem[] {
  const items: NeedsYouItem[] = [];
  for (const track of relay.tracks) {
    for (const state of track.gates) {
      for (const prompt of state.prompts) {
        if (prompt.status !== 'open') continue;
        items.push({
          relayId: relay.id,
          relayTitle: relay.title,
          role: track.role,
          gate: state.gate,
          owner: GATES[state.gate].owner,
          prompt,
        });
      }
    }
  }
  return items;
}

export function summarise(relay: Relay): RelaySummary {
  const research = relay.tracks.find((track) => track.id === 'research');
  const byRole = relay.roles.map((role) => {
    const gates = relay.tracks
      .filter((track) => track.role === role)
      .flatMap((track) => track.gates);
    const repo = relay.tracks.find((track) => track.role === role)?.repo;
    return { role, repo, gates };
  });
  const gate = currentGate(relay);
  return {
    id: relay.id,
    title: relay.title,
    version: relay.version,
    hubVersion: relay.hubVersion,
    tracker: relay.tracker,
    status: relayStatus(relay),
    stage: GATES[gate].track,
    currentGate: gate,
    roles: relay.roles,
    updatedAt: relay.updatedAt,
    research: research?.gates ?? [],
    byRole,
    waiting: openPrompts(relay).length,
    openQuestions: relay.questions.filter((question) => question.status === 'OPEN').length,
    localOnly: relay.localOnly,
  };
}

export function sortRelays(relays: RelaySummary[]): RelaySummary[] {
  return [...relays].sort((a, b) => {
    const rank = statusRank(a.status) - statusRank(b.status);
    if (rank !== 0) return rank;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function findTrack(relay: Relay, role: string | undefined, gate: GateId): Track | undefined {
  const track = GATES[gate].track;
  return relay.tracks.find((candidate) => {
    if (candidate.id !== track) return false;
    if (track === 'research') return true;
    return candidate.role === role;
  });
}

export function findGateState(
  relay: Relay,
  gate: GateId,
  role?: string,
): { track: Track; state: GateState } | undefined {
  const track = findTrack(relay, role, gate);
  if (!track) return undefined;
  const state = track.gates.find((candidate) => candidate.gate === gate);
  return state ? { track, state } : undefined;
}

/** Board metrics — only what the dashboard can actually compute (brief §13). */
export interface BoardMetrics {
  needsYou: number;
  openQuestions: number;
  oldestQuestionDays: number | null;
  gatesFailed: number;
  verdicts: { pass: number; partial: number; fail: number };
  scopeViolations: number;
  medianWaitMs: number | null;
}

export function boardMetrics(relays: Relay[], now = new Date()): BoardMetrics {
  let needsYou = 0;
  let gatesFailed = 0;
  let scopeViolations = 0;
  const verdicts = { pass: 0, partial: 0, fail: 0 };
  const waits: number[] = [];
  let openQuestions = 0;
  let oldestQuestionDays: number | null = null;

  for (const relay of relays) {
    needsYou += openPrompts(relay).length;
    for (const state of allGateStates(relay)) {
      if (state.status === 'failed') gatesFailed += 1;
      if (state.gate === 'verify' && state.verdict) {
        if (state.verdict === 'PASS') verdicts.pass += 1;
        else if (state.verdict === 'PARTIAL') verdicts.partial += 1;
        else verdicts.fail += 1;
      }
      scopeViolations += (state.guardEvents ?? []).filter((event) => event.decision === 'deny').length;
      for (const prompt of state.prompts) {
        if (prompt.answeredAt) {
          waits.push(new Date(prompt.answeredAt).getTime() - new Date(prompt.askedAt).getTime());
        } else if (prompt.status === 'open') {
          waits.push(now.getTime() - new Date(prompt.askedAt).getTime());
        }
      }
    }
    for (const question of relay.questions) {
      if (question.status !== 'OPEN') continue;
      openQuestions += 1;
      const days = Math.floor((now.getTime() - new Date(question.askedAt).getTime()) / 86_400_000);
      oldestQuestionDays = oldestQuestionDays === null ? days : Math.max(oldestQuestionDays, days);
    }
  }

  waits.sort((a, b) => a - b);
  const median =
    waits.length === 0
      ? null
      : waits.length % 2 === 1
        ? waits[(waits.length - 1) / 2]
        : Math.round((waits[waits.length / 2 - 1] + waits[waits.length / 2]) / 2);

  return {
    needsYou,
    openQuestions,
    oldestQuestionDays,
    gatesFailed,
    verdicts,
    scopeViolations,
    medianWaitMs: median,
  };
}

export const ALL_GATE_IDS: readonly GateId[] = GATE_LIST.map((gate) => gate.id);

/**
 * How long a relay may claim to be running after it last said anything.
 *
 * Every event a gate emits writes the relay, so a session that is genuinely working
 * touches this within seconds. Past the window the claim is a leftover: a process that
 * restarted mid-run, a machine that went to sleep, a gate killed between two steps.
 */
export const IN_FLIGHT_WINDOW_MS = 10 * 60_000;

/**
 * Whether anything is actually moving, which is a different question from whether a gate
 * is unfinished.
 *
 * `isActive` answers the second one and is right for a status chip: a gate waiting for an
 * answer is not finished and should not look finished. It was also being used to decide
 * whether the board should keep refreshing itself, and there the two questions come apart
 * badly — a question nobody has answered for two days made every open board re-scan the
 * whole workspace every four seconds, for two days, changing nothing each time.
 *
 * Work is in flight when a gate is running *and* the relay has said something recently.
 * Waiting is the opposite of in flight: nothing will change until a person acts, and when
 * they do, the act itself brings the screen up to date.
 */
export function hasWorkInFlight(
  gates: Pick<GateState, 'status'>[],
  updatedAt: string | undefined,
  now = Date.now(),
): boolean {
  if (!gates.some((gate) => gate.status === 'running')) return false;
  if (!updatedAt) return true;
  const last = Date.parse(updatedAt);
  return !Number.isFinite(last) || now - last < IN_FLIGHT_WINDOW_MS;
}

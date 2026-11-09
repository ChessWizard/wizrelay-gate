import { EventEmitter } from 'node:events';
import type { GateId } from '@/core/gates/gates';
import type { GateEvent, GateEventBody, LiveFrame } from '@/core/relay/events';
import { streamKey } from '@/core/relay/events';
import { currentActor } from '@/services/identity/actor';
import { findGateState, invalidateAfter, unblockRelay } from '@/core/relay/derive';
import type { GatePrompt, Relay } from '@/core/relay/types';
import { isTerminal, verdictToStatus } from '@/core/status/status';
import { planGate, trackGates } from '@/core/gates/steps';
import { appendEvent, countEvents, getRelay, getWorkspace, readEvents, saveRelay } from '@/services/store/store';
import { loadRelay } from '@/services/relays/service';
import type { Workspace } from '@/services/workspace/types';
import type { Placement } from '@/services/agent/placement';
import { canRunHere, placeRun } from '@/services/agent/placement';
import { notifyWaiting } from '@/services/panel/waiting';
import { record } from '@/services/panel/activity';
import { localeFor } from '@/services/panel/locale';
import type { Locale } from '@/shared/i18n/config';
import { localExecutor } from '@/services/shell/executor';
import { playBranch, scriptedEngine } from './scripted';
import type { StepPlanInput } from './steps';
import { stepsEngineFor } from './steps';
import type { Engine, EngineContext, PromptAnswer } from './types';

/**
 * The gate runner: it owns what is running, appends every event to the store, keeps the
 * relay's gate state in step with the console, and resolves a prompt when the person
 * answers it.
 *
 * One process, one machine, no queue — this is a local app, and a gate is a single async
 * function with a pause in the middle.
 */
interface ActiveRun {
  key: string;
  seq: number;
  stopped: boolean;
  pending?: { prompt: GatePrompt; resolve: (answer: PromptAnswer | null) => void };
}

/**
 * The registry lives on `globalThis`.
 *
 * A server action, a route handler and a server component can each get their own instance
 * of this module in development, and a module-level Map would then be three Maps: the
 * console would subscribe to one bus while the answer resolved a prompt on another. One
 * process, one registry.
 */
interface Registry {
  runs: Map<string, ActiveRun>;
  bus: EventEmitter;
}

const globalRegistry = globalThis as typeof globalThis & { __wizrelayGate?: Registry };

function registry(): Registry {
  if (!globalRegistry.__wizrelayGate) {
    const bus = new EventEmitter();
    bus.setMaxListeners(0);
    globalRegistry.__wizrelayGate = { runs: new Map(), bus };
  }
  return globalRegistry.__wizrelayGate;
}

const runs = registry().runs;
const bus = registry().bus;

export function isRunning(relayId: string, role: string | undefined, gate: GateId): boolean {
  return runs.has(streamKey(relayId, role, gate));
}

export function subscribe(key: string, listener: (event: GateEvent) => void): () => void {
  bus.on(key, listener);
  return () => bus.off(key, listener);
}

/**
 * The live channel, kept apart from the durable one.
 *
 * A console that drops a frame here has missed a few characters it is about to be sent
 * again in the finished message; a console that drops a durable event has missed part of
 * the record. Those deserve different guarantees, so they get different channels.
 */
export function subscribeLive(key: string, listener: (frame: LiveFrame) => void): () => void {
  const channel = `${key}::live`;
  bus.on(channel, listener);
  return () => bus.off(channel, listener);
}

/**
 * Which engine runs a gate.
 *
 * In a live workspace a gate is the list of commands the plugin documents, so the steps
 * engine runs them — it handles the conversational parts by handing those steps to Claude
 * itself. Demo mode, and a workspace with no checkout at all, replay the bundled
 * transcript instead, because there is nothing real to run against.
 */
async function pickEngine(
  mode: 'demo' | 'live',
  plan: StepPlanInput | null,
): Promise<Engine> {
  if (mode === 'demo' || !plan) return scriptedEngine;
  return stepsEngineFor(plan);
}

/** Everything the step planner needs, read once per run. */
async function planInputFor(
  relay: Relay,
  role: string | undefined,
  workspace: Workspace,
): Promise<StepPlanInput> {
  const repo = role ? workspace.repos.find((candidate) => candidate.role === role) : undefined;
  return {
    relayId: relay.id,
    title: relay.title,
    roles: relay.roles,
    role,
    folder: `${relay.id}-${relay.slug}`,
    hubBranch: workspace.hub?.branch ?? 'main',
    base: repo?.baseRef ?? 'origin/main',
  };
}

/**
 * Where this run's commands go, and in which folders.
 *
 * Demo mode replays a transcript, so it needs no machine and no checkout at all; asking
 * for one would make a demo fail on a laptop that has nothing cloned.
 */
async function placementFor(
  role: string | undefined,
  workspace: Workspace,
  userId: string | null | undefined,
): Promise<Placement> {
  if (workspace.mode !== 'live') return { executor: localExecutor, where: 'local' };
  return placeRun({ userId, role, workspace });
}

/**
 * The relay this run is about.
 *
 * The panel's store only holds relays something has already happened to here. Everything
 * else — every package the hub publishes — exists as files until the first gate runs, and
 * reading the store alone made starting that first gate a silent no-op: the screen showed
 * the relay, the button did nothing, and nothing was written anywhere to say why.
 *
 * So the live view answers when the store cannot, and the relay is written down before it
 * is used. From then on this is where its gate states, prompts and timings live.
 */
async function relayForRun(relayId: string): Promise<Relay | null> {
  const stored = await getRelay(relayId);
  if (stored) return stored;

  const live = await loadRelay(relayId);
  if (!live) return null;
  return saveRelay(live);
}

/** Fold one event into the relay's stored gate state, so lists and chips stay current. */
async function applyToRelay(
  relayId: string,
  role: string | undefined,
  gate: GateId,
  body: GateEventBody,
): Promise<void> {
  const relay = await getRelay(relayId);
  if (!relay) return;
  const found = findGateState(relay, gate, role);
  if (!found) return;
  const state = found.state;

  switch (body.kind) {
    case 'status':
      state.status = body.status;
      break;
    case 'check':
      state.checks = [...state.checks.filter((check) => check.id !== body.check.id), body.check];
      break;
    case 'prompt':
      state.prompts = [...state.prompts.filter((prompt) => prompt.id !== body.prompt.id), body.prompt];
      state.status = 'waiting';
      break;
    case 'prompt-answered': {
      const actor = await currentActor();
      state.prompts = state.prompts.map((prompt) =>
        prompt.id === body.promptId
          ? {
              ...prompt,
              status: 'answered' as const,
              answeredAt: new Date().toISOString(),
              answer: { optionId: body.answer, by: 'you' as const, actor },
            }
          : prompt,
      );
      break;
    }
    case 'artifact':
      state.artifacts = [
        ...state.artifacts.filter((artifact) => artifact.path !== body.artifact.path),
        body.artifact,
      ];
      break;
    case 'guard':
      state.guardEvents = [...(state.guardEvents ?? []), body.event];
      break;
    case 'command':
      state.commands = [
        ...(state.commands ?? []),
        { command: body.command, exitCode: body.exitCode },
      ];
      break;
    case 'done':
      state.verdict = body.verdict;
      state.status = verdictToStatus(body.verdict);
      state.result = body.summary;
      state.finishedAt = new Date().toISOString();
      state.durationMs = state.startedAt
        ? Date.now() - new Date(state.startedAt).getTime()
        : state.durationMs;
      break;
    default:
      break;
  }

  // A gate that just finished may have been the only thing standing in front of the next
  // one, so the sequence is recomputed here rather than left as whatever was written when
  // the relay was created.
  await saveRelay(body.kind === 'done' ? unblockRelay(relay) : relay);
}

interface ContextExtras {
  hubCwd?: string;
  readDirs?: string[];
  locale?: Locale;
  repoCwd?: string;
  only?: string;
  exec?: EngineContext['exec'];
  machine?: string;
  notes?: string;
  userId?: string | null;
}

function contextFor(
  relay: Relay,
  role: string | undefined,
  gate: GateId,
  run: ActiveRun,
  mode: 'demo' | 'live',
  cwd: string | undefined,
  message: string | undefined,
  cursor: number,
  extras: ContextExtras = {},
): EngineContext {
  return {
    relayId: relay.id,
    role,
    gate,
    cwd,
    hubCwd: extras.hubCwd,
    readDirs: extras.readDirs,
    locale: extras.locale,
    repoCwd: extras.repoCwd,
    only: extras.only,
    notes: extras.notes,
    userId: extras.userId,
    exec: extras.exec ?? localExecutor,
    machine: extras.machine,
    mode,
    message,
    cursor,
    async emit(body) {
      run.seq += 1;
      const event = await appendEvent(relay.id, role, gate, body, run.seq);
      await applyToRelay(relay.id, role, gate, body);
      bus.emit(run.key, event);
      return event;
    },
    live(frame) {
      bus.emit(`${run.key}::live`, frame);
    },
    async saveCursor(next) {
      const current = await getRelay(relay.id);
      if (!current) return;
      const found = findGateState(current, gate, role);
      if (!found) return;
      found.state.cursor = next;
      await saveRelay(current);
    },
    async ask(prompt) {
      let settle: (answer: PromptAnswer | null) => void = () => {};
      const waiting = new Promise<PromptAnswer | null>((resolve) => {
        settle = resolve;
      });
      run.pending = { prompt, resolve: settle };

      run.seq += 1;
      const event = await appendEvent(relay.id, role, gate, { kind: 'prompt', prompt }, run.seq);
      await applyToRelay(relay.id, role, gate, { kind: 'prompt', prompt });
      bus.emit(run.key, event);

      void notifyWaiting({
        userId: extras.userId ?? null,
        relayId: relay.id,
        role,
        gate,
        question: prompt.question,
      });

      void record({
        kind: 'QUESTION_ASKED',
        userId: extras.userId ?? null,
        relayId: relay.id,
        gate,
        summary: prompt.question.slice(0, 200),
      });

      return waiting;
    },
    stopped: () => run.stopped,
    sleep: (ms) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, Math.min(ms, 2_000));
      }),
  };
}

export interface StartOptions {
  relayId: string;
  role?: string;
  gate: GateId;
  message?: string;
  /**
   * Who pressed the button. On a shared panel this decides whose machine runs the gate,
   * so it is threaded from the server action rather than read from a session here: the
   * engine outlives the request that started it.
   */
  userId?: string | null;
  /** What the person added when the gate asked, carried into the session's brief. */
  notes?: string;
  /** Run one step of the gate rather than all of them, by its planned id. */
  only?: string;
  /** Wait for the gate to finish. Only a chained run does; a button press never does. */
  await?: boolean;
}

export async function startGate(options: StartOptions): Promise<{ started: boolean; reason?: string }> {
  const { relayId, role, gate, message } = options;
  const key = streamKey(relayId, role, gate);
  if (runs.has(key)) return { started: false, reason: 'already-running' };

  const relay = await relayForRun(relayId);
  if (!relay) return { started: false, reason: 'no-relay' };
  const found = findGateState(relay, gate, role);
  if (!found) return { started: false, reason: 'no-gate' };

  const workspace = await getWorkspace();
  const placement = await placementFor(role, workspace, options.userId);

  if (placement.blockedKey) return { started: false, reason: placement.blockedKey };

  const { cwd, hubCwd, repoCwd } = placement;
  const plan = workspace.mode === 'live' ? await planInputFor(relay, role, workspace) : null;

  // The same refusal the button shows, enforced where the run actually begins. A gate can
  // be started from a server action, from a track, or by a machine picking up a job, and
  // only one of those paths goes past a button.
  if (plan) {
    const steps = planGate(gate, { ...plan, branch: undefined });
    const verdict = canRunHere(placement, {
      repo: steps.some((step) => step.where === 'repo'),
      hub: steps.some((step) => step.where === 'hub'),
      hubWrites: steps.some((step) => step.where === 'hub' && !step.readOnly),
    });
    if (!verdict.ok) return { started: false, reason: verdict.reasonKey };
  }
  const engine = await pickEngine(workspace.mode, plan);

  const run: ActiveRun = { key, seq: await countEvents(relayId, role, gate), stopped: false };
  runs.set(key, run);

  found.state.status = 'running';
  // The clock starts at this run, not at the first attempt ever made. A gate retried
  // after an hour of fixing something else took minutes, and saying it took an hour
  // describes the day rather than the gate.
  found.state.startedAt = new Date().toISOString();
  found.state.result = undefined;
  found.state.verdict = undefined;
  found.state.durationMs = undefined;
  // It is running; whatever withdrew its last verdict has been answered by doing so.
  found.state.supersededAt = undefined;

  found.state.actor = placement.actor ?? (await currentActor(cwd));

  // Everything after this gate judged work that is about to be replaced. Those verdicts
  // are cleared here rather than left to say the package was checked.
  const cleared = invalidateAfter(relay, gate);
  const downstream = cleared !== relay;
  await saveRelay(cleared);

  if (downstream) {
    void record({
      kind: 'GATE_RUN',
      userId: options.userId ?? null,
      relayId,
      gate,
      summary: `rerun · later gates reset`,
    });
  }

  const context = contextFor(
    relay,
    role,
    gate,
    run,
    workspace.mode,
    cwd,
    message,

    options.only ? 0 : (found.state.cursor ?? 0),
    {
      hubCwd,
      repoCwd,
      only: options.only,
      exec: placement.executor,
      machine: placement.machine,
      readDirs: placement.readDirs,
      locale: await localeFor(options.userId),
      notes: options.notes,
      userId: options.userId,
    },
  );
  await context.emit({ kind: 'status', status: 'running', note: engine.name });
  if (placement.where === 'agent' && placement.machine) {
    await context.emit({ kind: 'machine', machine: placement.machine });
  }

  const finished = (async () => {
    try {
      const result = await engine.run(context);
      if (result.paused) return result;
      if (result.verdict) {
        await context.emit({
          kind: 'done',
          verdict: result.verdict,
          summary: result.summary ?? '',
        });

        void record({
          kind: 'GATE_RUN',
          userId: options.userId ?? null,
          relayId,
          gate,
          summary: `${result.verdict}${result.summary ? ` · ${result.summary.slice(0, 160)}` : ''}`,
        });
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await context.emit({ kind: 'error', message });
      await context.emit({ kind: 'done', verdict: 'FAIL', summary: 'The gate errored' });

      // A gate that threw is the one people most want to find afterwards, and it was the
      // one leaving no trace: the log recorded a run only where the engine returned a
      // verdict, so a crash looked like a gate that was never started.
      void record({
        kind: 'GATE_RUN',
        userId: options.userId ?? null,
        relayId,
        gate,
        summary: `FAIL · ${message.slice(0, 160)}`,
      });

      return { verdict: 'FAIL' as const };
    } finally {
      if (!run.pending) runs.delete(key);
    }
  })();

  if (options.await) await finished;
  else void finished;

  return { started: true };
}

/**
 * Run a whole track, gate by gate.
 *
 * It stops at the first gate that fails or pauses for an answer, because the gates after
 * it assume it finished — that is what a pipeline *is*. A gate already in a terminal state
 * is skipped rather than re-run, so continuing a half-finished track picks up where the
 * person left off instead of repeating work.
 */
export async function startTrack(options: {
  relayId: string;
  role?: string;
  track: 'research' | 'delivery';
  userId?: string | null;
}): Promise<{ started: boolean; ran: GateId[]; stoppedAt?: GateId; reason?: string }> {
  const relay = await relayForRun(options.relayId);
  if (!relay) return { started: false, ran: [], reason: 'no-relay' };

  const gates = trackGates(options.track);
  const ran: GateId[] = [];

  for (const gate of gates) {
    const current = await relayForRun(options.relayId);
    if (!current) break;
    const found = findGateState(current, gate, options.role);
    if (!found) continue;
    if (isTerminal(found.state.status) && found.state.status !== 'failed') continue;

    const result = await startGate({
      relayId: options.relayId,
      role: options.role,
      gate,
      await: true,
      userId: options.userId,
    });
    if (!result.started) return { started: ran.length > 0, ran, stoppedAt: gate, reason: result.reason };
    ran.push(gate);

    const after = await getRelay(options.relayId);
    const state = after ? findGateState(after, gate, options.role)?.state : undefined;

    if (!state || state.status === 'waiting' || state.status === 'failed') {
      return { started: true, ran, stoppedAt: gate };
    }
  }

  return { started: true, ran };
}

export async function answerPrompt(
  relayId: string,
  role: string | undefined,
  gate: GateId,
  promptId: string,
  answer: PromptAnswer,
  userId?: string | null,
): Promise<{ ok: boolean; reason?: string }> {
  const key = streamKey(relayId, role, gate);
  const run = runs.get(key);

  const relay = await relayForRun(relayId);
  if (!relay) return { ok: false, reason: 'no-relay' };
  const found = findGateState(relay, gate, role);
  if (!found) return { ok: false, reason: 'no-gate' };
  const prompt = found.state.prompts.find((candidate) => candidate.id === promptId);
  if (!prompt) return { ok: false, reason: 'no-prompt' };
  if (prompt.status === 'answered') return { ok: false, reason: 'already-answered' };

  const seq = (await countEvents(relayId, role, gate)) + 1;
  await appendEvent(
    relayId,
    role,
    gate,
    { kind: 'prompt-answered', promptId, answer: answer.optionId ?? answer.text ?? '' },
    seq,
  );
  await applyToRelay(relayId, role, gate, {
    kind: 'prompt-answered',
    promptId,
    answer: answer.optionId ?? answer.text ?? '',
  });

  const handoff = prompt.options?.find((option) => option.id === answer.optionId)?.handoff;

  if (run?.pending && run.pending.prompt.id === promptId) {
    const { resolve } = run.pending;
    run.pending = undefined;
    resolve(answer);
    return { ok: true };
  }

  const workspace = await getWorkspace();

  if (workspace.mode === 'live') {
    return startGate({ relayId, role, gate, userId, notes: answer.text }).then((started) =>
      started.started ? { ok: true } : { ok: false, reason: started.reason },
    );
  }

  const placement = await placementFor(role, workspace, userId);
  const fresh: ActiveRun = { key, seq, stopped: false };
  runs.set(key, fresh);
  const context = contextFor(relay, role, gate, fresh, workspace.mode, placement.cwd, undefined, 0, {
    hubCwd: placement.hubCwd,
    repoCwd: placement.repoCwd,
    exec: placement.executor,
    machine: placement.machine,
    userId,
  });
  await context.emit({ kind: 'status', status: handoff ? 'handoff' : 'running' });

  void (async () => {
    try {
      const result = await playBranch(gate, promptId, answer.optionId, context);
      if (result.paused) return;
      if (result.verdict) {
        await context.emit({
          kind: 'done',
          verdict: result.verdict,
          summary: result.summary ?? '',
        });
      }
    } catch (error) {
      await context.emit({
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (!fresh.pending) runs.delete(key);
    }
  })();

  return { ok: true };
}

export function stopGate(relayId: string, role: string | undefined, gate: GateId): boolean {
  const run = runs.get(streamKey(relayId, role, gate));
  if (!run) return false;
  run.stopped = true;
  run.pending?.resolve(null);
  runs.delete(run.key);
  return true;
}

export async function history(
  relayId: string,
  role: string | undefined,
  gate: GateId,
  fromSeq = 0,
): Promise<GateEvent[]> {
  return readEvents(relayId, role, gate, fromSeq);
}

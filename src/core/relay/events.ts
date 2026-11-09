import type { GateId } from '@/core/gates/gates';
import type { GateStatus, Verdict } from '@/core/status/status';
import type { Artifact, Check, GatePrompt, GuardEvent } from './types';

/** One line of a gate's console, or one thing a gate produced. */
export type GateEventBody =
  | { kind: 'status'; status: GateStatus; note?: string }
  /** Which machine picked this run up, when it was not the panel's own. */
  | { kind: 'machine'; machine: string }
  | { kind: 'message'; who: 'user' | 'claude'; text: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'tool'; name: string; target?: string; result?: string }
  | { kind: 'command'; command: string; output?: string; exitCode?: number }
  | { kind: 'diff'; file: string; owner: 'researcher' | 'developer'; lines: DiffLine[] }
  | { kind: 'check'; check: Check }
  | { kind: 'prompt'; prompt: GatePrompt }
  | { kind: 'prompt-answered'; promptId: string; answer: string }
  /** An outward-facing step that ran without asking, because the person said not to ask. */
  | { kind: 'approval-skipped'; command: string; kindOf: 'commit' | 'push' }
  | { kind: 'artifact'; artifact: Artifact }
  | { kind: 'guard'; event: GuardEvent }
  | { kind: 'attachment'; name: string; size: number; accepted: boolean; reason?: string }
  | { kind: 'done'; verdict: Verdict; summary: string }
  /** `tone` lets a warning read as one; the session writes both to stderr. */
  | { kind: 'error'; message: string; tone?: 'warn' };

/**
 * A frame that is shown and then forgotten.
 *
 * Claude emits a token at a time, and a console that cannot show that is a progress bar
 * with no bar: you wait, nothing moves, and you cannot tell a long thought from a hung
 * process. But a token is not a record — writing thousands of them to the gate's log
 * would turn a transcript into a keystroke dump and make every reload replay it.
 *
 * So the live frames travel on the bus only. They are never appended to the log, never
 * folded into the relay, and carry no sequence number, which is also why a console that
 * reconnects asks for the durable events and simply starts typing again from wherever the
 * session now is.
 */
export type LiveFrame =
  /** Text or thinking, as it arrives. */
  | { kind: 'delta'; channel: 'text' | 'thinking'; text: string }
  /** A content block ended, so whatever was typing is now final. */
  | { kind: 'block-end' }
  /** A tool call started; its name is known before its arguments are. */
  | { kind: 'tool-start'; name: string }
  /** The session's own word for what it is doing — requesting, compacting, and so on. */
  | { kind: 'working'; status: string };

export interface DiffLine {
  sign: '+' | '-' | ' ';
  line: number;
  text: string;
}

export interface GateEvent {
  seq: number;
  at: string;
  gate: GateId;
  role?: string;
  body: GateEventBody;
}

export function streamKey(relayId: string, role: string | undefined, gate: GateId): string {
  return `${relayId}__${role ?? 'hub'}__${gate}`;
}

export function isConsoleEvent(event: GateEvent): boolean {
  return (
    event.body.kind === 'message' ||
    event.body.kind === 'thinking' ||
    event.body.kind === 'tool' ||
    event.body.kind === 'command' ||
    event.body.kind === 'diff' ||
    event.body.kind === 'attachment' ||
    event.body.kind === 'machine' ||
    event.body.kind === 'error'
  );
}

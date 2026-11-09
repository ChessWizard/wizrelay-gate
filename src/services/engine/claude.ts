import { answerIn, gatePrompt, withNotes } from '@/core/gates/prompts';
import type { LiveFrame } from '@/core/relay/events';
import { BinaryMissing, which } from '@/services/shell/exec';
import type { Engine, EngineContext, EngineResult } from './types';
import { scriptedEngine } from './scripted';

/**
 * The live engine for the conversational gates: a headless Claude Code session in the
 * connected working copy, streamed into the gate console.
 *
 * The plugin's own skills do the work — the dashboard only types the command a person
 * would have typed. Scope decisions still come from the plugin's hooks inside that
 * session; they arrive here as text and are shown as information, never as something the
 * dashboard can override.
 *
 * The session is read twice over. `--include-partial-messages` gives the tokens as they
 * are produced, which is what makes the console feel like the terminal rather than like a
 * page that might be broken; those go to the live channel and are never written down. The
 * complete `assistant` message that follows is what gets recorded. So the transcript is
 * exactly what it always was, and the waiting is no longer silent.
 */

/**
 * Whether the panel's own machine has Claude Code.
 *
 * This is the question a screen asks before it promises a conversational gate. A run asks
 * it of the machine that will do the work instead — `context.exec.has('claude')` — because
 * on a shared panel the answer here is about the server, which is not where the session
 * would open.
 */
export async function claudeAvailable(): Promise<boolean> {
  return (await which('claude')) !== null;
}

/**
 * `acceptEdits`, because a gate that cannot write has not run.
 *
 * A skill's `allowed-tools` is a pre-approval for the turn, not a grant: writing
 * `plan.md` still asks. Interactively somebody answers; headlessly nobody can, and the
 * gate ends having described a plan it never wrote. What stops a session touching the
 * wrong file is not this prompt — it is the plugin's own scope guard, which runs as a
 * hook before any permission is considered and denies an edit outside the role's allow
 * list whatever this flag says.
 */
function argsFor(prompt: string, partial: boolean, readDirs?: string[]): string[] {
  const args = [
    '-p',
    prompt,
    '--output-format',
    'stream-json',
    '--permission-mode',
    'acceptEdits',
    '--verbose',
  ];

  // The checkouts this machine offers, so a research session can read the code it is
  // asked to cite. Without them the session runs in the hub and can see nothing else:
  // it reports that it cannot evidence anything, which is true and useless.
  for (const dir of readDirs ?? []) args.push('--add-dir', dir);

  if (partial) args.push('--include-partial-messages');
  return args;
}

/**
 * The invocation, without the prompt in it.
 *
 * The prompt is the line directly above this one in the console — printing it again
 * inside the command made every gate open by asking the same question twice. It also made
 * the command unrunnable, because a prompt pasted in unquoted is not one argument.
 */
function commandLine(args: string[]): string {
  return ['claude', ...args.map((argument, index) => (args[index - 1] === '-p' ? '…' : argument))].join(' ');
}

export const claudeEngine: Engine = {
  name: 'claude',
  async run(context: EngineContext): Promise<EngineResult> {
    if (!context.cwd) {
      await context.emit({
        kind: 'error',
        message: 'No working copy is connected for this role.',
      });
      return { verdict: 'FAIL', summary: 'No working copy' };
    }

    const locale = context.locale ?? 'en';
    const base =
      context.message ?? gatePrompt(context.gate, locale) ?? `Continue.\n\n${answerIn(locale)}`;
    const prompt = withNotes(base, context.notes);
    await context.emit({ kind: 'message', who: 'user', text: prompt });

    let outcome = await session(context, context.cwd, prompt, true);
    if (outcome.unsupportedFlag) outcome = await session(context, context.cwd, prompt, false);
    return outcome.result;
  },
};

interface Outcome {
  result: EngineResult;
  /** The run died because this Claude Code has no `--include-partial-messages`. */
  unsupportedFlag?: boolean;
}

async function session(
  context: EngineContext,
  cwd: string,
  prompt: string,
  partial: boolean,
): Promise<Outcome> {
  const args = argsFor(prompt, partial, context.readDirs);
  await context.emit({ kind: 'command', command: commandLine(args) });

  let text = '';
  let usage = '';
  let sawAnything = false;
  let stderr = '';
  /** The `result` event repeats the last answer; it is only news when there was none. */
  let final = '';

  try {
    for await (const chunk of context.exec.stream('claude', args, {
      cwd,
      timeoutMs: 900_000,
    })) {
      if (context.stopped()) return { result: { paused: true } };

      if ('exit' in chunk) {
        if (chunk.exit !== 0) {
          if (partial && !sawAnything && /unknown option|unrecognized/i.test(stderr)) {
            return { result: { verdict: 'FAIL' }, unsupportedFlag: true };
          }
          await context.emit({
            kind: 'error',
            message: `The session exited with code ${chunk.exit}.`,
          });
        }
        break;
      }

      if (chunk.stream === 'stderr') {
        stderr += `${chunk.line}\n`;
        if (chunk.line.trim()) {
          await context.emit({ kind: 'error', message: chunk.line, tone: warningTone(chunk.line) });
        }
        continue;
      }

      const parsed = parseLine(chunk.line);
      if (!parsed) continue;
      sawAnything = true;

      for (const frame of parsed.frames ?? []) context.live(frame);
      for (const body of parsed.bodies ?? []) {
        if (body.kind === 'message' && body.who === 'claude') text = body.text;
        await context.emit(body);
      }
      if (parsed.usage) usage = parsed.usage;
      if (parsed.final) final = parsed.final;
    }
  } catch (error) {
    if (error instanceof BinaryMissing) {
      await context.emit({
        kind: 'error',
        message:
          context.exec.where === 'agent'
            ? `Claude Code is not on PATH on ${context.machine ?? 'that machine'}, so this gate ran on the bundled transcript instead.`
            : 'Claude Code is not on PATH, so this gate ran on the bundled transcript instead.',
      });
      return { result: await scriptedEngine.run(context) };
    }
    throw error;
  }

  if (final && final.trim() !== text.trim()) {
    await context.emit({ kind: 'message', who: 'claude', text: final });
    text = final;
  }

  const summary = [text.slice(0, 160) || 'Session finished', usage].filter(Boolean).join(' · ');
  return { result: { verdict: 'PASS', summary } };
}

/**
 * The session narrating itself, filtered to what answers one question: is anything
 * happening yet.
 *
 * Measured on Claude Code 2.1.311 (2026-11-08), a two-tool turn narrates like this:
 *
 *     227ms  hook_started          2496ms  tool_use Read starts
 *     865ms  hook_response         6444ms  the message carrying that call
 *    1776ms  init                 13059ms  the tool returned
 *    1778ms  status requesting    15901ms  the answer starts
 *
 * Two things follow. The first seconds are the plugin's own hooks, and saying so is the
 * difference between a console that looks stuck and one that is visibly working. And a
 * tool is announced about four seconds before the message that contains it, so "running
 * Read" is news rather than a replay.
 *
 * The session also narrates a great deal nobody wants — turn summaries, command-list
 * changes, informational notices — and those are dropped.
 */
const SYSTEM_PHASE: Record<string, string> = {
  hook_started: 'hooks',
  init: 'starting',
};

/**
 * Whether a line on stderr is a fault or a remark.
 *
 * Claude Code writes both there, and a remark drawn as a fault — "8 permissions entries
 * ignored", say — makes a healthy run look broken. The two it is worth telling apart
 * announce themselves in the first word.
 */
function warningTone(line: string): 'warn' | undefined {
  return /^\s*(warning\b|ignoring\b|note:)/i.test(line) ? 'warn' : undefined;
}

type Body = Parameters<EngineContext['emit']>[0];

interface Parsed {
  /** What goes into the transcript. */
  bodies?: Body[];
  /** What is shown and forgotten. */
  frames?: LiveFrame[];
  /** The session's own accounting, appended to the gate's one-line result. */
  usage?: string;
  /** The `result` line's text, which is usually the last answer repeated. */
  final?: string;
}

function money(value: unknown): string | null {
  return typeof value === 'number' && value > 0 ? `$${value.toFixed(2)}` : null;
}

/** `claude --output-format stream-json` emits one JSON object per line. */
function parseLine(line: string): Parsed | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{')) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const event = parsed as Record<string, unknown>;

  if (event.type === 'stream_event') {
    const inner = (event.event ?? {}) as Record<string, unknown>;
    const kind = inner.type;

    if (kind === 'content_block_start') {
      const block = (inner.content_block ?? {}) as Record<string, unknown>;
      if (block.type === 'tool_use' && typeof block.name === 'string') {
        return { frames: [{ kind: 'tool-start', name: block.name }] };
      }
      return null;
    }

    if (kind === 'content_block_delta') {
      const delta = (inner.delta ?? {}) as Record<string, unknown>;
      if (delta.type === 'text_delta' && typeof delta.text === 'string') {
        return { frames: [{ kind: 'delta', channel: 'text', text: delta.text }] };
      }
      if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
        return { frames: [{ kind: 'delta', channel: 'thinking', text: delta.thinking }] };
      }
      return null;
    }

    if (kind === 'content_block_stop') return { frames: [{ kind: 'block-end' }] };
    return null;
  }

  if (event.type === 'system') {
    if (event.subtype === 'status') {
      return typeof event.status === 'string' ? { frames: [{ kind: 'working', status: event.status }] } : null;
    }
    const phase = typeof event.subtype === 'string' ? SYSTEM_PHASE[event.subtype] : undefined;
    return phase ? { frames: [{ kind: 'working', status: phase }] } : null;
  }

  if (event.type === 'assistant') {
    const message = event.message as { content?: unknown[] } | undefined;
    const out: Body[] = [];
    for (const part of message?.content ?? []) {
      const block = part as Record<string, unknown>;
      if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
        out.push({ kind: 'message', who: 'claude', text: block.text });
      }

      if (block.type === 'thinking' && typeof block.thinking === 'string' && block.thinking.trim()) {
        out.push({ kind: 'thinking', text: block.thinking });
      }
      if (block.type === 'tool_use' && typeof block.name === 'string') {
        const input = (block.input ?? {}) as Record<string, unknown>;
        const target =
          typeof input.file_path === 'string'
            ? input.file_path
            : typeof input.command === 'string'
              ? input.command
              : typeof input.pattern === 'string'
                ? input.pattern
                : undefined;
        out.push({ kind: 'tool', name: block.name, target });
      }
    }

    return { bodies: out, frames: [{ kind: 'block-end' }, { kind: 'working', status: 'thinking' }] };
  }

  if (event.type === 'result') {
    const result = typeof event.result === 'string' ? event.result : '';
    const usage = (event.usage ?? {}) as Record<string, unknown>;
    const seconds =
      typeof event.duration_ms === 'number'
        ? Math.round(event.duration_ms / 1000)
        : typeof event.duration_api_ms === 'number'
          ? Math.round(event.duration_api_ms / 1000)
          : null;
    const cost = money(event.total_cost_usd);
    const tokens =
      typeof usage.output_tokens === 'number' ? `${usage.output_tokens} tok` : null;
    const accounting = [seconds ? `${seconds}s` : null, tokens, cost].filter(Boolean).join(' · ');

    return {
      final: result || undefined,
      frames: [{ kind: 'block-end' }],
      usage: accounting || undefined,
    };
  }

  return null;
}

import type { GateId } from '@/core/gates/gates';
import type { GatePrompt } from '@/core/relay/types';
import type { ScriptStep } from '@/services/fixtures/transcripts';
import { TRANSCRIPTS } from '@/services/fixtures/transcripts';
import type { Engine, EngineContext, EngineResult } from './types';

/**
 * The scripted engine.
 *
 * It plays a gate's transcript, pausing on every prompt until a person answers — the
 * pause is real, not a timer. Branches are looked up by prompt id, so answering works
 * even after the server restarted: the answer names the branch, and the branch is the
 * rest of the gate.
 */
export const scriptedEngine: Engine = {
  name: 'scripted',
  async run(context: EngineContext): Promise<EngineResult> {
    const steps = TRANSCRIPTS[context.gate] ?? [];
    return play(steps, context);
  },
};

export async function playBranch(
  gate: GateId,
  promptId: string,
  optionId: string | undefined,
  context: EngineContext,
): Promise<EngineResult> {
  const branch = findBranch(TRANSCRIPTS[gate] ?? [], promptId, optionId);
  if (!branch) return { verdict: 'PASS', summary: 'Answered' };
  return play(branch, context);
}

/** Depth-first search for the branch a prompt's answer selects. */
function findBranch(
  steps: ScriptStep[],
  promptId: string,
  optionId: string | undefined,
): ScriptStep[] | null {
  for (const step of steps) {
    if (step.t !== 'prompt') continue;
    if (step.prompt.id === promptId) {
      const branches = step.branches ?? {};
      return branches[optionId ?? ''] ?? branches['*'] ?? null;
    }
    for (const nested of Object.values(step.branches ?? {})) {
      const found = findBranch(nested, promptId, optionId);
      if (found) return found;
    }
  }
  return null;
}

async function play(steps: ScriptStep[], context: EngineContext): Promise<EngineResult> {
  for (const step of steps) {
    if (context.stopped()) return { paused: true };
    if ('delay' in step && step.delay) await context.sleep(step.delay);

    switch (step.t) {
      case 'message':
        await context.emit({ kind: 'message', who: step.who, text: step.text });
        break;
      case 'thinking':
        await context.emit({ kind: 'thinking', text: step.text });
        break;
      case 'tool':
        await context.emit({
          kind: 'tool',
          name: step.name,
          target: step.target,
          result: step.result,
        });
        break;
      case 'command':
        await context.emit({
          kind: 'command',
          command: step.command,
          output: step.output,
          exitCode: step.exitCode ?? 0,
        });
        break;
      case 'diff':
        await context.emit({
          kind: 'diff',
          file: step.file,
          owner: step.owner,
          lines: step.lines,
        });
        break;
      case 'check':
        await context.emit({
          kind: 'check',
          check: { id: `C${Date.now().toString(36)}`, ...step.check },
        });
        break;
      case 'guard':
        await context.emit({
          kind: 'guard',
          event: {
            at: new Date().toISOString(),
            decision: step.decision,
            file: step.file,
            pattern: step.pattern,
            allow: step.allow,
          },
        });
        break;
      case 'artifact':
        await context.emit({
          kind: 'artifact',
          artifact: {
            path: step.path,
            kind: 'file',
            owner: step.owner,
            summary: step.summary,
          },
        });
        break;
      case 'prompt': {
        const prompt: GatePrompt = {
          ...step.prompt,
          gate: context.gate,
          status: 'open',
          askedAt: new Date().toISOString(),
        };
        const answer = await context.ask(prompt);
        if (!answer) return { paused: true };
        return playBranch(context.gate, prompt.id, answer.optionId, context);
      }
      case 'done':
        return { verdict: step.verdict, summary: step.summary };
    }
  }
  return { verdict: 'PASS', summary: 'Finished' };
}

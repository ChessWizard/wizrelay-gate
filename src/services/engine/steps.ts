import type { GateStep } from '@/core/gates/steps';
import { planGate } from '@/core/gates/steps';
import type { Check, GatePrompt } from '@/core/relay/types';
import type { Verdict } from '@/core/status/status';
import { BinaryMissing } from '@/services/shell/exec';
import { approvalChoice, preApproved } from './approval';
import { claudeEngine } from './claude';
import { scriptedEngine } from './scripted';
import type { Engine, EngineContext, EngineResult } from './types';

/**
 * The engine that runs a gate.
 *
 * A gate is a short list of steps — some commands, some a conversation — and this walks
 * them in order in the right working copy, printing each command before it runs and
 * recording its exit code after. Three rules shape it:
 *
 *   * **Nothing outward happens without a yes.** A commit or a push stops and asks, with
 *     the exact command in the question. Declining skips that step and caps the verdict;
 *     it never fails the gate, because choosing not to push is not an error.
 *   * **A missing value is asked for, not guessed.** `publish-prep` needs a changelog
 *     line, `ship` needs a commit message; the gate pauses for them.
 *   * **A step that cannot run says why.** No working copy for this role, no CLI on PATH,
 *     no Claude session — each is a failed check naming the cause, not a silent skip.
 *
 * The cursor is the index of the next step, so answering a prompt resumes where it paused
 * instead of replaying commands that already ran.
 */

type Outcome = 'pass' | 'fail' | 'skip';

function verdictOf(outcomes: Outcome[]): Verdict {
  if (outcomes.includes('fail')) return 'FAIL';
  if (outcomes.includes('skip')) return 'PARTIAL';
  return 'PASS';
}

function approvalPrompt(step: GateStep, cwd: string): GatePrompt {
  return {
    id: `${step.id}.approve`,
    gate: step.gate,
    variant: 'approval',
    question: step.command,
    detail: cwd,
    payload: { command: step.command, target: cwd },
    options: [
      { id: 'run', label: 'run' },
      { id: 'skip', label: 'skip' },
    ],
    status: 'open',
    askedAt: new Date().toISOString(),
  };
}

const NEEDS_QUESTION = {
  summary: 'prompt.needs.summary',
  message: 'prompt.needs.message',
  notes: 'prompt.needs.notes',
} as const;

const NEEDS_DESTINATION = {
  summary: 'task.json',
  message: 'git commit -m',
  notes: 'plan.md',
} as const;

function inputPrompt(step: GateStep): GatePrompt {
  const needs = step.needs ?? 'message';
  return {
    id: `${step.id}.input`,
    gate: step.gate,
    variant: 'input',
    question: NEEDS_QUESTION[needs],
    destination: NEEDS_DESTINATION[needs],
    status: 'open',
    askedAt: new Date().toISOString(),
  };
}

export interface StepPlanInput {
  relayId: string;
  title: string;
  roles: string[];
  role?: string;
  folder: string;
  hubBranch: string;
  branch?: string;
  base?: string;
  summary?: string;
  message?: string;
}

/**
 * The engine needs the relay's values to fill the commands. The runner reads them once and
 * hands them over, so this module never touches the store.
 */
export function stepsEngineFor(input: StepPlanInput): Engine {
  return {
    name: 'steps',
    async run(context: EngineContext): Promise<EngineResult> {
      let plan = planGate(context.gate, input);
      if (plan.length === 0) return scriptedEngine.run(context);

      const outcomes: Outcome[] = [];
      const cwdFor = (step: GateStep) => (step.where === 'hub' ? context.hubCwd : context.repoCwd);

      const record = async (check: Check, outcome: Outcome) => {
        outcomes.push(outcome);
        await context.emit({ kind: 'check', check });
      };

      const startAt = context.only ? plan.findIndex((step) => step.id === context.only) : context.cursor;
      const endAt = context.only ? startAt + 1 : plan.length;
      if (startAt < 0) return { verdict: 'FAIL', summary: 'Unknown step' };

      for (let index = Math.max(0, startAt); index < endAt; index += 1) {
        if (context.stopped()) return { paused: true };
        const step = plan[index];
        await context.saveCursor(index);

        if (step.kind === 'conversation') {
          let notes = context.notes;
          if (step.needs === 'notes' && !context.only) {
            const answer = await context.ask(inputPrompt(step));
            if (!answer) return { paused: true };
            notes = (answer.text ?? '').trim() || undefined;
          }

          const engine = (await context.exec.has('claude')) ? claudeEngine : scriptedEngine;
          const result = await engine.run({
            ...context,
            notes,
            cwd: cwdFor(step) ?? context.cwd,
          });
          if (result.paused) return result;
          outcomes.push(result.verdict === 'FAIL' ? 'fail' : result.verdict === 'PARTIAL' ? 'skip' : 'pass');
          continue;
        }

        if (step.kind === 'manual') {
          await record(
            { id: step.id, status: 'skip', message: step.labelKey },
            'skip',
          );
          continue;
        }

        const cwd = cwdFor(step);
        if (!cwd) {
          await record(
            {
              id: step.id,
              status: 'fail',
              message:
                step.where === 'hub' ? 'check.noHubCopy' : 'check.noRepoForRole',
              command: step.command,
            },
            'fail',
          );
          continue;
        }

        if (step.needs) {
          const answer = await context.ask(inputPrompt(step));
          if (!answer) return { paused: true };
          const value = (answer.text ?? '').trim();
          if (!value) {
            await record({ id: step.id, status: 'skip', message: step.labelKey }, 'skip');
            continue;
          }
          input = { ...input, [step.needs]: value };
          plan = planGate(context.gate, input);
          index -= 1;
          continue;
        }

        if (step.approval) {
          const allowed = preApproved(await approvalChoice(context.userId, context.relayId), step.approval);
          if (allowed) {
            await context.emit({ kind: 'approval-skipped', command: step.command, kindOf: step.approval });
          } else {
            const answer = await context.ask(approvalPrompt(step, cwd));
            if (!answer) return { paused: true };
            if (answer.optionId !== 'run') {
              await record(
                { id: step.id, status: 'skip', message: step.labelKey, command: step.command },
                'skip',
              );
              continue;
            }
          }
        }

        await context.emit({ kind: 'command', command: step.command });

        try {
          const result = await context.exec.run(step.binary!, step.args!, { cwd, timeoutMs: 300_000 });
          const ok = result.code === 0;
          await context.emit({
            kind: 'command',
            command: step.command,
            output: (result.stdout || result.stderr).slice(0, 8_000),
            exitCode: result.code,
          });
          await record(
            {
              id: step.id,
              status: ok ? 'pass' : 'fail',
              message: step.labelKey,
              command: step.command,
              output: (result.stdout || result.stderr).slice(0, 2_000),
            },
            ok ? 'pass' : 'fail',
          );

          if (!ok && !step.readOnly) break;
        } catch (error) {
          const missing = error instanceof BinaryMissing;
          await record(
            {
              id: step.id,
              status: 'fail',
              message: missing ? 'check.binaryMissing' : 'check.commandError',
              command: step.command,
              output: error instanceof Error ? error.message : String(error),
            },
            'fail',
          );
          break;
        }
      }

      await context.saveCursor(0);
      const verdict = verdictOf(outcomes);
      return {
        verdict,
        summary: '',
      };
    },
  };
}

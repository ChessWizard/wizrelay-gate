import type { AgentBinary } from '@/core/agent/protocol';
import { AgentTimeout, JobRefused, enqueue, followJob, waitForResult } from '@/services/agent/jobs';
import { BinaryMissing, run, runStreaming, which } from './exec';
import type { Binary, ExecOptions, ExecResult } from './exec';

/**
 * Where a command runs.
 *
 * Everything above this line — gates, steps, prompts, approvals, the console — was written
 * against `run` and `runStreaming` and never needs to know. That is what makes a panel on
 * a shared server possible without rewriting the engine: the same gate, the same steps,
 * the same approvals, executed on the machine that actually has the checkout.
 *
 *   * **local** is the panel's own machine. Right for a panel somebody runs on their
 *     laptop, and the only thing that used to exist.
 *   * **agent** is a machine somebody paired. The command is queued, the agent picks it
 *     up, runs it in its own checkout with its own tools, and the output comes back.
 *
 * A gate started by a person runs on that person's machine. Not on the server, and not on
 * a colleague's: the job carries the agent id it was enqueued for, and an agent is only
 * ever handed jobs of its own.
 */

export type StreamItem = { stream: 'stdout' | 'stderr'; line: string } | { exit: number };

export interface Executor {
  readonly where: 'local' | 'agent';
  /** The machine's name, for the console line that says where a command ran. */
  readonly machine?: string;
  run(binary: Binary, args: string[], options: ExecOptions): Promise<ExecResult>;
  stream(binary: Binary, args: string[], options: ExecOptions): AsyncGenerator<StreamItem>;
  has(binary: Binary): Promise<boolean>;
}

export const localExecutor: Executor = {
  where: 'local',
  run,
  stream: runStreaming,
  async has(binary) {
    return (await which(binary)) !== null;
  },
};

export interface AgentTarget {
  agentId: string;
  machine: string;
  relayId?: string;
  role?: string;
  gate?: string;
}

function asAgentBinary(binary: Binary): AgentBinary {
  return binary as AgentBinary;
}

/**
 * An executor that runs nothing itself.
 *
 * A refused job and an absent binary both have to reach the engine as the errors it
 * already handles, or every caller would need a second set of branches for the remote
 * case. `BinaryMissing` is the one the engine knows; a refusal is a hard error, because a
 * command the machine will not run is not a command that failed.
 */
export function agentExecutor(target: AgentTarget): Executor {
  const meta = { relayId: target.relayId, role: target.role, gate: target.gate };

  return {
    where: 'agent',
    machine: target.machine,

    async run(binary, args, options) {
      const timeoutMs = options.timeoutMs ?? 60_000;
      const job = await enqueue({
        agentId: target.agentId,
        kind: 'exec',
        binary: asAgentBinary(binary),
        args,
        cwd: options.cwd,
        timeoutMs,
        ...meta,
      });
      const result = await waitForResult(job.id, timeoutMs);
      if (result.error === 'binary-missing') throw new BinaryMissing(binary);
      if (result.error) throw new Error(result.error);
      return {
        code: result.code,
        stdout: result.stdout,
        stderr: result.stderr,
        command: job.command,
        timedOut: result.timedOut,
      };
    },

    async *stream(binary, args, options) {
      const timeoutMs = options.timeoutMs ?? 900_000;
      const job = await enqueue({
        agentId: target.agentId,
        kind: 'stream',
        binary: asAgentBinary(binary),
        args,
        cwd: options.cwd,
        timeoutMs,
        ...meta,
      });

      for await (const item of followJob(job.id, timeoutMs)) {
        if (item.chunk) {
          for (const line of item.chunk.line.split('\n')) {
            yield { stream: item.chunk.stream, line };
          }
          continue;
        }
        if (item.result) {
          if (item.result.error === 'binary-missing') throw new BinaryMissing(binary);
          yield { exit: item.result.code };
        }
      }
    },

    async has(binary) {
      try {
        const job = await enqueue({
          agentId: target.agentId,
          kind: 'which',
          binary: asAgentBinary(binary),
          args: [],
          timeoutMs: 10_000,
          ...meta,
        });
        const result = await waitForResult(job.id, 10_000);
        return result.code === 0;
      } catch (error) {
        if (error instanceof AgentTimeout || error instanceof JobRefused) return false;
        throw error;
      }
    },
  };
}

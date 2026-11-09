import type { AgentJob } from '@prisma/client';
import type { AgentBinary, AgentJobChunk, AgentJobKind, AgentJobRequest, AgentJobResult } from '@/core/agent/protocol';
import { describeCommand, refuseJob } from '@/core/agent/protocol';
import { prisma } from '@/services/db/client';
import { rootsOf } from './registry';

/**
 * The job queue between the panel and a machine.
 *
 * It is a table, not a socket, and that is the point. The panel may be several worker
 * processes behind a load balancer: the process that enqueues a gate's first command is
 * often not the one the agent long-polls, and neither is guaranteed to be the one still
 * holding the browser's event stream. A row every process can see is the only channel that
 * survives all three.
 *
 * Waiting is a poll with a short interval rather than a notification. It costs one small
 * query every quarter second for as long as a command runs, which is nothing next to the
 * command, and it has no way to lose a wake-up.
 */

const POLL_MS = 250;
/** What a person reading a console notices; a quarter of it is wasted work. */
const FOLLOW_MS = 120;

export interface EnqueueInput {
  agentId: string;
  kind: AgentJobKind;
  binary: AgentBinary;
  args: string[];
  cwd?: string;
  /** For a `read` or a `write`: the file on the machine. */
  path?: string;
  /** For a `write`: the whole new contents. */
  body?: string;
  timeoutMs: number;
  relayId?: string;
  role?: string;
  gate?: string;
}

export class JobRefused extends Error {
  constructor(readonly detail: string) {
    super(detail);
    this.name = 'JobRefused';
  }
}

export class AgentTimeout extends Error {
  constructor(readonly jobId: string) {
    super(`The machine did not answer in time (job ${jobId})`);
    this.name = 'AgentTimeout';
  }
}

export async function enqueue(input: EnqueueInput): Promise<AgentJob> {
  const agent = await prisma.agent.findUnique({ where: { id: input.agentId } });
  if (!agent || agent.revokedAt) throw new JobRefused('agent');

  // A file job runs no program, so the line the panel logs and the console prints
  // describes what it did to the file rather than naming a binary it never used.
  const command =
    input.kind === 'read' || input.kind === 'write' || input.kind === 'list'
      ? `${input.kind} ${input.path ?? '(no path)'}`
      : describeCommand(input.binary, input.args);
  const refusal = refuseJob(
    {
      id: 'pending',
      kind: input.kind,
      binary: input.binary,
      args: input.args,
      cwd: input.cwd,
      path: input.path,
      body: input.body,
      timeoutMs: input.timeoutMs,
      command,
    },
    rootsOf(agent),
  );

  if (refusal) throw new JobRefused(`${refusal.reason}: ${refusal.detail}`);

  return prisma.agentJob.create({
    data: {
      agentId: input.agentId,
      kind: input.kind,
      binary: input.binary,
      args: input.args as unknown as object,
      cwd: input.cwd ?? null,
      path: input.path ?? null,
      body: input.body ?? null,
      command,
      timeoutMs: input.timeoutMs,
      relayId: input.relayId ?? null,
      role: input.role ?? null,
      gate: input.gate ?? null,
    },
  });
}

/**
 * Hand the next queued job to the machine that asked for it.
 *
 * `updateMany` with the state in the filter is the claim: two panel processes answering
 * the same long-poll cannot both win, because the second one updates zero rows.
 */
export async function claimNext(agentId: string): Promise<AgentJobRequest | null> {
  const queued = await prisma.agentJob.findFirst({
    where: { agentId, state: 'QUEUED' },
    orderBy: { createdAt: 'asc' },
  });
  if (!queued) return null;

  const claimed = await prisma.agentJob.updateMany({
    where: { id: queued.id, state: 'QUEUED' },
    data: { state: 'CLAIMED', claimedAt: new Date() },
  });
  if (claimed.count === 0) return null;

  return {
    id: queued.id,
    kind: queued.kind as AgentJobKind,
    binary: queued.binary as AgentBinary,
    args: (queued.args as unknown as string[]) ?? [],
    cwd: queued.cwd ?? undefined,
    path: queued.path ?? undefined,
    body: queued.body ?? undefined,
    timeoutMs: queued.timeoutMs,
    command: queued.command,
  };
}

/**
 * One row per flush, not one per line.
 *
 * A Claude session with partial messages on produces a line per token — thousands for one
 * answer. A row each would make the machine hop the slowest part of a fast session and
 * leave a keystroke dump in the database. The agent batches what accumulates between round
 * trips into a single row, newline-separated, and the reader splits it again: same order,
 * same content, roughly fifty times fewer writes.
 */
export async function appendChunk(jobId: string, chunk: AgentJobChunk): Promise<void> {
  await prisma.agentJobChunk.upsert({
    where: { jobId_seq: { jobId, seq: chunk.seq } },
    update: {},
    create: { jobId, seq: chunk.seq, stream: chunk.stream, line: chunk.line },
  });
}

export async function finish(jobId: string, result: AgentJobResult): Promise<void> {
  await prisma.agentJob.updateMany({
    where: { id: jobId, state: 'CLAIMED' },
    data: {
      state: result.error ? 'FAILED' : 'DONE',
      exitCode: result.code,
      stdout: result.stdout.slice(0, 200_000),
      stderr: result.stderr.slice(0, 200_000),
      timedOut: result.timedOut,
      error: result.error ?? null,
      endedAt: new Date(),
    },
  });

  await prisma.agentJobChunk.deleteMany({ where: { jobId } });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Wait for a job to end.
 *
 * The budget is the command's own timeout plus a grace period: the agent is expected to
 * kill its child at the timeout and report back, and the grace covers the round trip. Past
 * that the machine has gone quiet, which is a different failure and reads differently.
 */
export async function waitForResult(jobId: string, timeoutMs: number): Promise<AgentJobResult> {
  const deadline = Date.now() + timeoutMs + 15_000;

  while (Date.now() < deadline) {
    const job = await prisma.agentJob.findUnique({ where: { id: jobId } });
    if (!job) throw new AgentTimeout(jobId);
    if (job.state === 'DONE' || job.state === 'FAILED') {
      return {
        code: job.exitCode ?? -1,
        stdout: job.stdout ?? '',
        stderr: job.stderr ?? '',
        timedOut: job.timedOut,
        error: job.error ?? undefined,
      };
    }
    await sleep(POLL_MS);
  }

  await prisma.agentJob.updateMany({
    where: { id: jobId, state: { in: ['QUEUED', 'CLAIMED'] } },
    data: { state: 'EXPIRED', endedAt: new Date() },
  });
  throw new AgentTimeout(jobId);
}

export interface StreamItem {
  chunk?: AgentJobChunk;
  result?: AgentJobResult;
}

/**
 * Replay a streaming job's lines as they arrive, then its result.
 *
 * `after` is the last sequence number already yielded, so a reader that stalls catches up
 * instead of losing lines — the same contract the gate console uses with its own event
 * log, for the same reason.
 */
export async function* followJob(jobId: string, timeoutMs: number): AsyncGenerator<StreamItem> {
  const deadline = Date.now() + timeoutMs + 15_000;
  let after = -1;

  while (Date.now() < deadline) {
    const chunks = await prisma.agentJobChunk.findMany({
      where: { jobId, seq: { gt: after } },
      orderBy: { seq: 'asc' },
      take: 500,
    });
    for (const row of chunks) {
      after = row.seq;
      yield { chunk: { seq: row.seq, stream: row.stream as 'stdout' | 'stderr', line: row.line } };
    }

    const job = await prisma.agentJob.findUnique({
      where: { id: jobId },
      select: { state: true, exitCode: true, stdout: true, stderr: true, timedOut: true, error: true },
    });
    if (!job) throw new AgentTimeout(jobId);

    if (job.state === 'DONE' || job.state === 'FAILED') {
      const rest = await prisma.agentJobChunk.findMany({
        where: { jobId, seq: { gt: after } },
        orderBy: { seq: 'asc' },
      });
      for (const row of rest) {
        after = row.seq;
        yield { chunk: { seq: row.seq, stream: row.stream as 'stdout' | 'stderr', line: row.line } };
      }
      yield {
        result: {
          code: job.exitCode ?? -1,
          stdout: job.stdout ?? '',
          stderr: job.stderr ?? '',
          timedOut: job.timedOut,
          error: job.error ?? undefined,
        },
      };
      return;
    }

    if (chunks.length === 0) await sleep(FOLLOW_MS);
  }

  throw new AgentTimeout(jobId);
}

/** Housekeeping: jobs nobody claimed, and the output of jobs long finished. */
export async function sweepJobs(olderThanMs = 24 * 3_600_000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const expired = await prisma.agentJob.updateMany({
    where: { state: { in: ['QUEUED', 'CLAIMED'] }, createdAt: { lt: new Date(Date.now() - 3_600_000) } },
    data: { state: 'EXPIRED', endedAt: new Date() },
  });
  await prisma.agentJob.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return expired.count;
}

/**
 * Read a file from a machine, or write one to it.
 *
 * The panel reads packages off its own disk, which is only ever the right answer when the
 * package is on its disk. On a shared panel it is not: the work happens in a person's own
 * checkout and, until it is published, nothing in the panel can show it or correct a line
 * of it. This is that way — the same queue, the same guards, the same refusals.
 */
export async function fileOnAgent(input: {
  agentId: string;
  kind: 'read' | 'write' | 'list';
  path: string;
  body?: string;
  timeoutMs?: number;
}): Promise<{ ok: true; body: string } | { ok: false; error: string }> {
  const timeoutMs = input.timeoutMs ?? 20_000;

  try {
    const job = await enqueue({
      agentId: input.agentId,
      kind: input.kind,
      // A file job runs no program; the field is the queue's, not this job's.
      binary: 'git',
      args: [],
      path: input.path,
      body: input.body,
      timeoutMs,
    });

    const result = await waitForResult(job.id, timeoutMs + 5_000);
    if (result.code !== 0) return { ok: false, error: result.stderr || `exited ${result.code}` };
    return { ok: true, body: result.stdout };
  } catch (error) {
    if (error instanceof JobRefused) return { ok: false, error: error.detail };
    if (error instanceof AgentTimeout) return { ok: false, error: 'timeout' };
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

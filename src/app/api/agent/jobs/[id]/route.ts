import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { AgentJobChunk, AgentJobResult } from '@/core/agent/protocol';
import { agentForToken, bearer } from '@/services/agent/registry';
import { appendChunk, finish } from '@/services/agent/jobs';
import { prisma } from '@/services/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Payload {
  chunks?: AgentJobChunk[];
  result?: AgentJobResult;
}

/**
 * What came out of a command.
 *
 * Lines and the final result arrive through the same call so a streaming job can report
 * its tail and its exit code in one round trip, and a one-shot job needs no second call at
 * all. Each line carries its own sequence number, which is what lets the panel re-read a
 * job it was already halfway through without losing or repeating a line.
 *
 * A job is only writable by the machine it was handed to; the agent id on the row is
 * checked against the token, not taken from the request.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const agent = await agentForToken(bearer(request.headers.get('authorization')));
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const job = await prisma.agentJob.findUnique({ where: { id }, select: { agentId: true, state: true } });
  if (!job || job.agentId !== agent.id) return NextResponse.json({ error: 'not-found' }, { status: 404 });

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  for (const chunk of payload.chunks ?? []) {
    if (typeof chunk?.seq !== 'number' || typeof chunk?.line !== 'string') continue;
    await appendChunk(id, {
      seq: chunk.seq,
      stream: chunk.stream === 'stderr' ? 'stderr' : 'stdout',

      line: chunk.line.slice(0, 512_000),
    });
  }

  if (payload.result) {
    await finish(id, {
      code: Number(payload.result.code ?? -1),
      stdout: String(payload.result.stdout ?? ''),
      stderr: String(payload.result.stderr ?? ''),
      timedOut: Boolean(payload.result.timedOut),
      error: payload.result.error ? String(payload.result.error).slice(0, 500) : undefined,
    });
  }

  await prisma.agent.update({ where: { id: agent.id }, data: { lastSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
}

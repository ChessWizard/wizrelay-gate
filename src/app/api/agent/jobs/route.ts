import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { agentForToken, bearer } from '@/services/agent/registry';
import { claimNext } from '@/services/agent/jobs';
import { prisma } from '@/services/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_WAIT_MS = 25_000;
const TICK_MS = 500;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * The agent asks for work, and the request waits rather than returning empty.
 *
 * A long poll is the quietest way to get a job onto a machine that has no address: the
 * connection is already open and outbound, so no port is forwarded and no firewall rule is
 * written. Holding it for twenty-five seconds keeps the request well inside every proxy's
 * idle timeout while costing one connection per machine.
 *
 * The poll doubles as a heartbeat, so a machine that is waiting for work still counts as
 * online even when nothing has been queued for it all afternoon.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const agent = await agentForToken(bearer(request.headers.get('authorization')));
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  await prisma.agent.update({ where: { id: agent.id }, data: { lastSeenAt: new Date() } });

  const url = new URL(request.url);
  const waitMs = Math.min(Number(url.searchParams.get('wait') ?? MAX_WAIT_MS) || MAX_WAIT_MS, MAX_WAIT_MS);
  const deadline = Date.now() + waitMs;

  do {
    if (request.signal.aborted) return NextResponse.json({ job: null });
    const job = await claimNext(agent.id);
    if (job) return NextResponse.json({ job });
    await sleep(TICK_MS, request.signal);
  } while (Date.now() < deadline);

  return NextResponse.json({ job: null });
}

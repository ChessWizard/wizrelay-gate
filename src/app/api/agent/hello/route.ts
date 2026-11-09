import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { AGENT_PROTOCOL_VERSION, type AgentHello } from '@/core/agent/protocol';
import { agentForToken, bearer, recordHello } from '@/services/agent/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The heartbeat, and the inventory.
 *
 * One call does both on purpose: the panel's idea of what a machine can do should never be
 * older than its idea of whether the machine is there. What arrives is a list of working
 * copies the person chose to expose, which binaries the machine found, and the Claude
 * account it is signed in to — the last of which is how a run gets stamped with a person
 * rather than with the server.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const agent = await agentForToken(bearer(request.headers.get('authorization')));
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let hello: AgentHello;
  try {
    hello = (await request.json()) as AgentHello;
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  if (Number(hello?.protocol) !== AGENT_PROTOCOL_VERSION) {
    return NextResponse.json({ error: 'protocol', expected: AGENT_PROTOCOL_VERSION }, { status: 409 });
  }

  const saved = await recordHello(agent.id, hello);

  return NextResponse.json({
    ok: true,
    agentId: saved.id,
    agentName: saved.name,
    protocol: AGENT_PROTOCOL_VERSION,
    /** How long the agent may hold a poll open before asking again. */
    pollMs: 25_000,
  });
}

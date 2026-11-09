import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { AGENT_PROTOCOL_VERSION, type AgentPairRequest } from '@/core/agent/protocol';
import { branding } from '@/services/panel/branding';
import { redeemPairing } from '@/services/agent/registry';
import { record } from '@/services/panel/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A machine introduces itself.
 *
 * This is the one agent endpoint with no bearer token, because the token is what it comes
 * here to get. What it brings instead is a code the person read off the panel seconds
 * earlier: short-lived, single-use, and bound to the account that asked for it. A wrong
 * code is answered the same way as an expired one, so guessing learns nothing.
 */
export async function POST(request: NextRequest): Promise<Response> {
  let body: AgentPairRequest;
  try {
    body = (await request.json()) as AgentPairRequest;
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  if (typeof body?.code !== 'string') {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }
  if (Number(body.protocol) !== AGENT_PROTOCOL_VERSION) {
    return NextResponse.json(
      { error: 'protocol', expected: AGENT_PROTOCOL_VERSION },
      { status: 409 },
    );
  }

  const paired = await redeemPairing({
    code: body.code,
    hostname: String(body.hostname ?? '').slice(0, 120),
    platform: String(body.platform ?? '').slice(0, 60),
    agentVersion: String(body.agentVersion ?? '').slice(0, 40),
    protocol: AGENT_PROTOCOL_VERSION,
  });
  if (!paired) return NextResponse.json({ error: 'code' }, { status: 403 });

  const brand = await branding();
  await record({
    kind: 'SIGNED_IN',
    userId: paired.agent.userId,
    summary: `agent ${paired.agent.name}`,
  });

  return NextResponse.json({
    token: paired.token,
    agentId: paired.agent.id,
    agentName: paired.agent.name,
    panelName: brand.name,
    userName: paired.userName,
    userEmail: paired.userEmail,
  });
}

import type { NextRequest } from 'next/server';
import { isGateId } from '@/core/gates/gates';
import { relayForRequest } from '@/services/auth/api';
import { gateEventStream, SSE_HEADERS } from '@/services/engine/stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The console's server-sent events; the stream itself lives in the engine. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; gate: string }> },
): Promise<Response> {
  const { id, gate } = await context.params;
  if (!isGateId(gate)) return new Response('unknown gate', { status: 404 });

  const relayId = decodeURIComponent(id);
  const access = await relayForRequest(relayId);
  if (!access.ok) return new Response(null, { status: access.status });

  const url = new URL(request.url);
  const stream = gateEventStream({
    relayId,
    role: url.searchParams.get('role') ?? undefined,
    gate,
    from: Number(url.searchParams.get('from') ?? '0') || 0,
    signal: request.signal,
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

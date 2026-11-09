import { headers } from 'next/headers';

/**
 * The address this panel is reached at, from outside.
 *
 * Three things are being reconciled. The operator may have said it outright, which
 * settles it. Behind a proxy the request's own `host` is the proxy's internal name and
 * the scheme is plain HTTP even where the public one is HTTPS, so the forwarded headers
 * are read before the request's own. And a panel somebody runs on their laptop is on
 * `localhost` over HTTP, which no amount of production-mode guessing should turn into
 * `https`.
 *
 * It matters because two things people are handed carry this address and nothing else:
 * the invitation link, which is somebody's first experience of the panel, and the pairing
 * command, which is the only way a machine ever reaches it. Either one built from a guess
 * is a link that goes nowhere, found by the person least able to fix it.
 */
export async function panelOrigin(): Promise<string> {
  const configured = process.env.WIZRELAY_GATE_URL?.trim().replace(/\/+$/, '');
  if (configured) return configured;

  const head = await headers();
  const host = head.get('x-forwarded-host') ?? head.get('host') ?? 'localhost:3100';
  const forwarded = head.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = forwarded ?? (local ? 'http' : 'https');

  return `${proto}://${host}`;
}

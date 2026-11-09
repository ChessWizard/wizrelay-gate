import type { Relay } from '@/core/relay/types';
import { loadRelay } from '@/services/relays/service';
import { currentSession } from './session';

/**
 * Access for a route handler.
 *
 * Every screen in the panel is a server component behind `requireUser`, so it was easy to
 * believe the panel was closed. The routes are not screens: a request to a relay's event
 * stream carried no session at all, and it streams a console — Claude's reasoning, the
 * commands, the file contents. Anything reachable over HTTP asks here first.
 *
 * `null` means no session: the caller answers 401 rather than redirecting, because a
 * fetch cannot follow a redirect to a login form in any useful way.
 */
export async function apiSession() {
  return currentSession();
}

export type RelayAccess =
  | { ok: true; relay: Relay }
  | { ok: false; status: 401 | 403 | 404 };

/**
 * The relay behind a route, if this request may have it.
 *
 * `loadRelay` already filters by membership, so an unreadable relay is indistinguishable
 * from one that does not exist — which is the right answer to give: whether a task exists
 * is itself something only its team should learn.
 */
export async function relayForRequest(relayId: string): Promise<RelayAccess> {
  const session = await apiSession();
  if (!session) return { ok: false, status: 401 };

  const relay = await loadRelay(relayId);
  if (!relay) return { ok: false, status: 404 };

  return { ok: true, relay };
}

import type { GateId } from '@/core/gates/gates';
import { isGateId } from '@/core/gates/gates';
import type { GateStatus } from '@/core/status/status';
import { isGateStatus } from '@/core/status/status';
import type { RelaySummary } from '@/core/relay/types';
import { fold } from '@/core/text/fold';

/**
 * The board's search, as a value rather than a string.
 *
 * A query is free text plus optional `key:value` terms, because the board is a list of
 * relays and the two questions people actually ask it are "where is CU-86c1" and "what is
 * waiting on backend". Both have to work from one box.
 */
export interface Query {
  /** What is left after the `key:value` terms are taken out, folded for comparison. */
  text: string;
  roles: string[];
  statuses: GateStatus[];
  gates: GateId[];
  /** `needs:me` — only relays with an open prompt. */
  needsMe: boolean;
  /** The query as the person typed it, so the box can show it back unchanged. */
  raw: string;
}

export const EMPTY_QUERY: Query = {
  text: '',
  roles: [],
  statuses: [],
  gates: [],
  needsMe: false,
  raw: '',
};

const PREFIXES = ['role', 'status', 'gate', 'needs'] as const;

/**
 * Parse one query string.
 *
 * Unknown prefixes stay in the free text: someone searching for `http://host:3100` means
 * it literally, and a term the board does not understand should narrow nothing rather
 * than silently drop a word the person typed.
 */
export function parseQuery(raw: string): Query {
  const roles: string[] = [];
  const statuses: GateStatus[] = [];
  const gates: GateId[] = [];
  let needsMe = false;
  const rest: string[] = [];

  for (const token of raw.split(/\s+/).filter(Boolean)) {
    const separator = token.indexOf(':');
    const prefix = separator === -1 ? '' : fold(token.slice(0, separator));
    const value = separator === -1 ? '' : token.slice(separator + 1);

    if (!value || !PREFIXES.includes(prefix as (typeof PREFIXES)[number])) {
      rest.push(token);
      continue;
    }

    if (prefix === 'role') roles.push(fold(value));
    else if (prefix === 'status' && isGateStatus(fold(value))) statuses.push(fold(value) as GateStatus);
    else if (prefix === 'gate' && isGateId(fold(value))) gates.push(fold(value) as GateId);
    else if (prefix === 'needs') needsMe = fold(value) === 'me';
    else rest.push(token);
  }

  return { text: fold(rest.join(' ')), roles, statuses, gates, needsMe, raw };
}

export function isEmptyQuery(query: Query): boolean {
  return (
    query.text === '' &&
    query.roles.length === 0 &&
    query.statuses.length === 0 &&
    query.gates.length === 0 &&
    !query.needsMe
  );
}

/** Every string on a relay that someone might search by. */
function haystack(relay: RelaySummary): string {
  return fold(
    [relay.id, relay.title, relay.tracker.ref, relay.tracker.type, ...relay.roles].join(' '),
  );
}

function statusesOf(relay: RelaySummary): GateStatus[] {
  return [
    relay.status,
    ...relay.research.map((state) => state.status),
    ...relay.byRole.flatMap((role) => role.gates.map((state) => state.status)),
  ];
}

function gatesOf(relay: RelaySummary): GateId[] {
  return [
    relay.currentGate,
    ...relay.research.map((state) => state.gate),
    ...relay.byRole.flatMap((role) => role.gates.map((state) => state.gate)),
  ];
}

export function matches(relay: RelaySummary, query: Query): boolean {
  if (query.text && !haystack(relay).includes(query.text)) return false;
  if (query.needsMe && relay.waiting === 0) return false;

  if (query.roles.length > 0) {
    const roles = relay.roles.map(fold);
    if (!query.roles.some((role) => roles.includes(role))) return false;
  }

  if (query.statuses.length > 0) {
    const statuses = statusesOf(relay);
    if (!query.statuses.some((status) => statuses.includes(status))) return false;
  }

  if (query.gates.length > 0) {
    const gates = gatesOf(relay);
    if (!query.gates.some((gate) => gates.includes(gate))) return false;
  }

  return true;
}

export function search(relays: RelaySummary[], query: Query): RelaySummary[] {
  if (isEmptyQuery(query)) return relays;
  return relays.filter((relay) => matches(relay, query));
}

/**
 * Toggle one `key:value` term, which is how a filter chip edits the query the box shows.
 * Removing a term leaves the rest of the query — including the free text — untouched.
 */
export function toggleTerm(raw: string, key: (typeof PREFIXES)[number], value: string): string {
  const term = `${key}:${value}`;
  const tokens = raw.split(/\s+/).filter(Boolean);
  const index = tokens.findIndex((token) => fold(token) === fold(term));
  if (index >= 0) return tokens.filter((_, position) => position !== index).join(' ');
  return [...tokens, term].join(' ');
}

export function hasTerm(raw: string, key: (typeof PREFIXES)[number], value: string): boolean {
  const term = fold(`${key}:${value}`);
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .some((token) => fold(token) === term);
}

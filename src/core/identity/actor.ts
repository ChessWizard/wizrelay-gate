import { fold } from '@/core/text/fold';

/**
 * Who did a thing.
 *
 * There is no sign-up and no user table. The person at the keyboard is already identified
 * twice over on their own machine — by the Claude Code account they are signed in to, and
 * by the git identity their commits carry — so the dashboard reads that instead of asking
 * for it. `source` says which one answered, because a run stamped from the git config is
 * a weaker claim than one stamped from a signed-in Claude session, and the UI says so.
 */
export type ActorSource = 'claude' | 'git' | 'system';

export interface Actor {
  /** Stable across sessions: the email where there is one, else the system user name. */
  id: string;
  name: string;
  email?: string;
  organization?: string;
  source: ActorSource;
  /**
   * Other names and emails that are the same person.
   *
   * Someone signs in to Claude Code as "Night Owl" and commits as "İlknur ŞAHİN" from a
   * `users.noreply.github.com` address. Nothing in either record connects the two, but
   * the machine knows both, so the identity that wins carries the other as an alias and
   * the two stop showing up as two people.
   */
  aliases?: string[];
}

export const UNKNOWN_ACTOR: Actor = { id: 'unknown', name: 'unknown', source: 'system' };

/** Two initials for the avatar, from the name where it has words and the email otherwise. */
export function initials(actor: Pick<Actor, 'name' | 'email'>): string {
  const words = actor.name
    .split(/[\s._-]+/)
    .map((word) => word.trim())
    .filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  const source = words[0] ?? actor.email ?? '?';
  return source.slice(0, 2).toUpperCase();
}

/**
 * Whether two identities are the same person. The git email and the Claude email are
 * often different — a `users.noreply.github.com` address next to a work address — so a
 * name match counts too, folded for Turkish.
 */
function keys(actor: Actor): string[] {
  return [actor.id, actor.name, actor.email, ...(actor.aliases ?? [])]
    .filter((value): value is string => Boolean(value))
    .map(fold);
}

export function sameActor(left: Actor, right: Actor): boolean {
  const mine = keys(left);
  return keys(right).some((key) => mine.includes(key));
}

/** A colour index for the avatar, stable per identity, from the chart ramp. */
export function actorTone(actor: Pick<Actor, 'id'>): number {
  let hash = 0;
  for (const character of actor.id) hash = (hash * 31 + character.charCodeAt(0)) % 997;
  return (hash % 6) + 1;
}

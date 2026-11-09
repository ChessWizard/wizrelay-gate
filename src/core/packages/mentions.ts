/**
 * `@` in a package, a question or an answer.
 *
 * A question written during research is addressed to somebody: the architect who knows
 * why the cache is there, the person who owns the contract. Until now every question went
 * to everyone, which is how a question becomes nobody's. A mention is how the person
 * writing it says who it is for, in the one notation everybody already types.
 *
 * A handle is an email address, which is what the panel knows people by, or a bare name
 * for somebody it does not — a tracker account, someone not on the panel yet. Both are
 * kept: the panel resolves what it can and shows the rest as written, rather than
 * silently dropping a name it does not recognise.
 */

const MENTION =
  /(^|[\s(\[{<,;:"'])@([A-Za-z0-9._%+-]+(?:@[A-Za-z0-9.-]+\.[A-Za-z]{2,})?)/g;

/** A handle as it is compared: lowercase, without the trailing punctuation of a sentence. */
export function normaliseHandle(handle: string): string {
  return handle.trim().replace(/^@/, '').replace(/[.,;:]+$/, '').toLowerCase();
}

/** Every `@handle` in a piece of text, in order, without repeats. */
export function parseMentions(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(MENTION)) {
    const handle = normaliseHandle(match[2]);
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);
    found.push(handle);
  }
  return found;
}

/** Whether a handle names an address rather than a bare name. */
export function isEmailHandle(handle: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(handle);
}

/**
 * The handle written for somebody the panel knows.
 *
 * Their address, because that is unique and it is what they signed in with; a name is
 * for display and two people can share one.
 */
export function handleFor(person: { email: string }): string {
  return normaliseHandle(person.email);
}

/**
 * Turn `@handle` into something to render, leaving the rest of the text alone.
 *
 * The caller decides what a mention looks like; this only says where they are, so the
 * same parsing serves the console, a question card and a tracker comment.
 */
export function splitMentions(text: string): { text: string; handle?: string }[] {
  const parts: { text: string; handle?: string }[] = [];
  let at = 0;

  for (const match of text.matchAll(MENTION)) {
    const lead = match[1] ?? '';
    const start = (match.index ?? 0) + lead.length;
    if (start > at) parts.push({ text: text.slice(at, start) });
    const raw = match[2];
    parts.push({ text: `@${raw}`, handle: normaliseHandle(raw) });
    at = start + raw.length + 1;
  }

  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}

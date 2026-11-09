import { handleFor } from '@/core/packages/mentions';
import { prisma } from '@/services/db/client';
import { listMembers } from '@/services/integrations/clickup';

export interface Mentionable {
  handle: string;
  name: string;
  /** Where the panel learned about them, which is also what it can promise about them. */
  source: 'panel' | 'tracker';
}

/**
 * The people a mention can name.
 *
 * Everybody who can sign in here, and everybody in the connected tracker workspace. The
 * second group matters more than it looks: the person who knows why a contract is shaped
 * the way it is often has no account on this panel, and a question for them has to be
 * addressable before it can be routed anywhere.
 *
 * The tracker call can be slow or simply fail — a token that expired, no network — and
 * when it does the panel's own people are still offered rather than nothing at all.
 */
export async function mentionablePeople(userId: string): Promise<Mentionable[]> {
  const [people, members] = await Promise.all([
    prisma.user.findMany({
      where: { disabled: false },
      select: { email: true, name: true },
      orderBy: { name: 'asc' },
    }),
    listMembers(userId).catch(() => []),
  ]);

  const byHandle = new Map<string, Mentionable>();
  for (const person of people) {
    const handle = handleFor(person);
    byHandle.set(handle, { handle, name: person.name, source: 'panel' });
  }
  for (const member of members) {
    const handle = handleFor(member);

    if (byHandle.has(handle)) continue;
    byHandle.set(handle, { handle, name: member.username, source: 'tracker' });
  }

  return [...byHandle.values()].sort((a, b) => a.name.localeCompare(b.name));
}

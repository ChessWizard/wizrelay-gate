import type { Viewer } from '@/core/auth/roles';
import { canSeeAllActivity } from '@/core/auth/roles';
import { slicePage } from '@/core/paging/cursor';
import { prisma } from '@/services/db/client';
import type { ActivityKind } from '@prisma/client';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  at: Date;
  summary: string;
  relayId: string | null;
  gate: string | null;
  actorName: string | null;
  actorEmail: string | null;
  projectRole: string | null;
  hubName: string | null;
}

/**
 * What this log is for: what people did to tasks.
 *
 * It used to hold everything the panel noticed — sign-ins, hubs connected, members given
 * a role — and the result was a feed in which the one thing anybody looks for, "who ran
 * that gate and what did it say", scrolled past between administrative noise. Those
 * events are real but they belong to administration, not to the work.
 *
 * Read and write both go through this list, so the screen can never show a kind nothing
 * records, and nothing can be recorded that the screen will not show.
 */
export const TASK_ACTIVITY = [
  'GATE_RUN',
  'PROMPT_ANSWERED',
  'QUESTION_ASKED',
  'QUESTION_ANSWERED',
  'PACKAGE_PUBLISHED',
] as const satisfies readonly ActivityKind[];

export const ACTIVITY_PAGE = 40;

export interface ActivityPage {
  entries: ActivityEntry[];
  /** Pass back as `before` for the next page; absent when this is the last one. */
  nextCursor: string | null;
}

/**
 * Everything the viewer may see: their own, or everybody's for whoever administers.
 *
 * Paged by cursor rather than by offset. The log is written to while it is being read —
 * a gate finishing shifts every row down — so page two of an offset query skips whatever
 * arrived in between and shows it twice on page three. A cursor is a position in the
 * list, so what has already been read stays read.
 *
 * Ordered by time and then by id. Two rows written in the same millisecond are ordinary
 * here — a track runs its gates in a loop — and without the second key their order is
 * whatever the database feels like, which makes the cursor skip or repeat them.
 */
export async function listActivity(
  viewer: Viewer,
  options: { limit?: number; before?: string | null; userId?: string | null } = {},
): Promise<ActivityPage> {
  const limit = options.limit ?? ACTIVITY_PAGE;
  const mine = !canSeeAllActivity(viewer);

  // A member sees their own however they filter; an administrator may name anybody.
  const who = mine ? viewer.id : (options.userId ?? null);

  const query = (before: string | null) =>
    prisma.activity.findMany({
      where: {
        kind: { in: [...TASK_ACTIVITY] },
        ...(who ? { userId: who } : {}),
      },
      orderBy: [{ at: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
      include: {
        user: { select: { name: true, email: true } },
        project: { select: { role: true } },
        hub: { select: { name: true } },
      },
    });

  // A cursor is a row id in a URL, and a URL outlives the row it names — a bookmark, a
  // link somebody sent, a log that has since been trimmed. Falling back to the first page
  // is the right answer; a crash is not.
  const rows = await query(options.before ?? null).catch(() =>
    options.before ? query(null) : Promise.resolve([]),
  );

  const page = slicePage(rows, limit);

  return {
    entries: page.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      at: row.at,
      summary: row.summary,
      relayId: row.relayId,
      gate: row.gate,
      actorName: row.user?.name ?? null,
      actorEmail: row.user?.email ?? null,
      projectRole: row.project?.role ?? null,
      hubName: row.hub?.name ?? null,
    })),
    nextCursor: page.nextCursor,
  };
}

/**
 * The people who appear in the log, for the filter.
 *
 * Taken from the log itself rather than from the user table: somebody who has done
 * nothing is not a useful thing to filter by, and somebody who has since been removed
 * still has rows that need explaining.
 */
export async function activityActors(
  viewer: Viewer,
): Promise<{ id: string; name: string }[]> {
  if (!canSeeAllActivity(viewer)) return [];

  const rows = await prisma.activity.groupBy({
    by: ['userId'],
    where: { kind: { in: [...TASK_ACTIVITY] }, userId: { not: null } },
  });

  const ids = rows.map((row) => row.userId).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];

  const people = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return people;
}

/**
 * Record something somebody did to a task.
 *
 * Anything outside that list is dropped here rather than filtered at the other end: a row
 * nothing will ever read is a row that only grows the table and the next person's
 * confusion about what this log is.
 */
export async function record(input: {
  kind: ActivityKind;
  userId?: string | null;
  projectId?: string | null;
  hubId?: string | null;
  relayId?: string | null;
  gate?: string | null;
  summary: string;
}): Promise<void> {
  if (!(TASK_ACTIVITY as readonly string[]).includes(input.kind)) return;
  try {
    await prisma.activity.create({ data: input });
  } catch {
  }
}

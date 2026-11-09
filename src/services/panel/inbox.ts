import { prisma } from '@/services/db/client';

export interface InboxEntry {
  id: string;
  kind: 'QUESTION' | 'RESEARCH_READY' | 'MENTION';
  title: string;
  body: string | null;
  href: string | null;
  projectName: string | null;
  relayId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export async function listInbox(userId: string, limit = 50): Promise<InboxEntry[]> {
  const rows = await prisma.inboxItem.findMany({
    where: { userId },
    orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
    take: limit,
    include: { project: { select: { role: true, name: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    projectName: row.project ? `${row.project.role}` : null,
    relayId: row.relayId,
    readAt: row.readAt,
    createdAt: row.createdAt,
  }));
}

/** Put something in front of one person. Deduplicated on the relay and kind. */
export async function notify(input: {
  userId: string;
  projectId?: string | null;
  kind: InboxEntry['kind'];
  relayId?: string | null;
  title: string;
  body?: string | null;
  href?: string | null;
}): Promise<void> {
  const existing = await prisma.inboxItem.findFirst({
    where: {
      userId: input.userId,
      kind: input.kind,
      relayId: input.relayId ?? null,
      readAt: null,
    },
  });
  if (existing) return;

  await prisma.inboxItem.create({
    data: {
      userId: input.userId,
      projectId: input.projectId ?? null,
      kind: input.kind,
      relayId: input.relayId ?? null,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
    },
  });
}

export async function markRead(userId: string, id: string): Promise<void> {
  await prisma.inboxItem.updateMany({
    where: { id, userId },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.inboxItem.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

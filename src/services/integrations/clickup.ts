import { prisma } from '@/services/db/client';
import { decryptSecret } from '@/services/auth/crypto';

const API = 'https://api.clickup.com/api/v2';

export interface ClickUpTask {
  id: string;
  name: string;
  url: string;
  status: string | null;
  assignees: { id: number; username: string; email: string }[];
  description: string | null;
}

export interface ClickUpComment {
  id: string;
  text: string;
  user: string;
  at: string;
}

async function tokenFor(userId: string): Promise<string | null> {
  const row = await prisma.connection.findUnique({
    where: { userId_kind: { userId, kind: 'CLICKUP' } },
  });
  return decryptSecret(row?.secretEnc) ?? process.env.CLICKUP_API_TOKEN ?? null;
}

async function call<T>(token: string, path: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: token, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getTask(userId: string, taskId: string): Promise<ClickUpTask | null> {
  const token = await tokenFor(userId);
  if (!token) return null;

  const raw = await call<{
    id: string;
    name: string;
    url: string;
    status?: { status: string };
    assignees?: { id: number; username: string; email: string }[];
    description?: string;
  }>(token, `/task/${encodeURIComponent(taskId)}`);
  if (!raw) return null;

  return {
    id: raw.id,
    name: raw.name,
    url: raw.url,
    status: raw.status?.status ?? null,
    assignees: raw.assignees ?? [],
    description: raw.description ?? null,
  };
}

export async function getComments(userId: string, taskId: string): Promise<ClickUpComment[]> {
  const token = await tokenFor(userId);
  if (!token) return [];

  const raw = await call<{
    comments: { id: string; comment_text: string; user?: { username: string }; date: string }[];
  }>(token, `/task/${encodeURIComponent(taskId)}/comment`);
  if (!raw) return [];

  return raw.comments.map((comment) => ({
    id: comment.id,
    text: comment.comment_text,
    user: comment.user?.username ?? '',
    at: new Date(Number(comment.date)).toISOString(),
  }));
}

/** Post a comment, optionally assigning it to the person who should answer. */
export async function postComment(
  userId: string,
  taskId: string,
  text: string,
  assignee?: number,
): Promise<boolean> {
  const token = await tokenFor(userId);
  if (!token) return false;

  const result = await call<{ id: string }>(token, `/task/${encodeURIComponent(taskId)}/comment`, {
    method: 'POST',
    body: JSON.stringify({
      comment_text: text,
      assignee,
      notify_all: false,
    }),
  });
  return Boolean(result);
}

export async function hasClickUp(userId: string): Promise<boolean> {
  return Boolean(await tokenFor(userId));
}

export interface ClickUpMember {
  id: number;
  username: string;
  email: string;
}

/**
 * The people in the tracker workspace.
 *
 * A question is often for somebody who has never opened this panel — the architect whose
 * name is on the card. Offering them alongside the panel's own members is what makes the
 * mention worth typing; whether they can answer here is a separate matter, and the
 * tracker comment is how it reaches them.
 */
export async function listMembers(userId: string): Promise<ClickUpMember[]> {
  const token = await tokenFor(userId);
  if (!token) return [];

  const teams = await call<{ teams?: { members?: { user?: ClickUpMember }[] }[] }>(token, '/team');
  if (!teams?.teams) return [];

  const byEmail = new Map<string, ClickUpMember>();
  for (const team of teams.teams) {
    for (const entry of team.members ?? []) {
      const user = entry.user;
      if (!user?.email) continue;
      byEmail.set(user.email.toLowerCase(), {
        id: user.id,
        username: user.username ?? user.email,
        email: user.email,
      });
    }
  }
  return [...byEmail.values()];
}

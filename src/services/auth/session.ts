import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { Viewer } from '@/core/auth/roles';
import { prisma } from '@/services/db/client';
import { serverSecret } from './secret';

const COOKIE = 'wizrelay_session';
const DAYS = 14;

function sign(token: string): string {
  return createHmac('sha256', serverSecret()).update(token).digest('base64url');
}

function sameToken(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createSession(userId: string, userAgent?: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + DAYS * 86_400_000);

  await prisma.session.create({ data: { userId, tokenHash: sign(token), expiresAt, userAgent } });
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sign(token) } });
  jar.delete(COOKIE);
}

export interface SignedInUser {
  id: string;
  email: string;
  name: string;
  claudeRef: string | null;
  globalRole: Viewer['globalRole'];
  locale: string | null;
}

/** The signed-in user and everything the permission rules need, or null. */
export async function currentSession(): Promise<{ user: SignedInUser; viewer: Viewer } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sign(token) },
    include: { user: { include: { memberships: true } } },
  });
  if (!session || !sameToken(session.tokenHash, sign(token))) return null;
  if (session.expiresAt < new Date() || session.user.disabled) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  const projects: Viewer['projects'] = {};
  for (const membership of session.user.memberships) {
    projects[membership.projectId] = membership.roles as Viewer['projects'][string];
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      claudeRef: session.user.claudeRef,
      globalRole: session.user.globalRole,
      locale: session.user.locale,
    },
    viewer: { id: session.user.id, globalRole: session.user.globalRole, projects },
  };
}

/**
 * End every session but this one.
 *
 * Changing a password is also how someone reacts to a borrowed laptop, so the other
 * sessions have to go. The one doing the changing stays, otherwise the act of securing
 * the account logs you out of it.
 */
export async function revokeOtherSessions(userId: string): Promise<number> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  const result = await prisma.session.deleteMany({
    where: token ? { userId, tokenHash: { not: sign(token) } } : { userId },
  });
  return result.count;
}

export async function clearExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

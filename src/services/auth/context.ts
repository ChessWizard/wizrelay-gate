import { redirect } from 'next/navigation';
import type { Viewer } from '@/core/auth/roles';
import { currentSession } from './session';
import type { SignedInUser } from './session';

export interface AppContext {
  user: SignedInUser;
  viewer: Viewer;
}

/** The signed-in user, or a redirect to the login screen. */
export async function requireUser(): Promise<AppContext> {
  const session = await currentSession();
  if (!session) redirect('/login');
  return session;
}

export async function requireOwner(): Promise<AppContext> {
  const session = await requireUser();
  if (session.viewer.globalRole !== 'OWNER') redirect('/');
  return session;
}

export async function requireAdmin(): Promise<AppContext> {
  const session = await requireUser();
  if (session.viewer.globalRole === 'MEMBER') redirect('/');
  return session;
}

'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { prisma } from '@/services/db/client';
import { ensureOwner } from '@/services/auth/bootstrap';
import { checkPassword, hashPassword, verifyPassword } from '@/services/auth/password';
import { requireUser } from '@/services/auth/context';
import { createSession, destroySession, revokeOtherSessions } from '@/services/auth/session';

export interface AuthResult {
  ok: boolean;
  errorKey?: string;
}

export async function signIn(_state: AuthResult | null, formData: FormData): Promise<AuthResult> {
  await ensureOwner();

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { ok: false, errorKey: 'auth.error.missing' };

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !valid) return { ok: false, errorKey: 'auth.error.invalid' };
  if (user.disabled) return { ok: false, errorKey: 'auth.error.disabled' };

  const agent = (await headers()).get('user-agent') ?? undefined;
  await createSession(user.id, agent);

  redirect('/');
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect('/login');
}

export async function acceptInvite(
  _state: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password !== confirm) return { ok: false, errorKey: 'auth.error.mismatch' };
  const rule = checkPassword(password);
  if (!rule.ok) return { ok: false, errorKey: rule.reasonKey };

  const user = await prisma.user.findUnique({ where: { inviteToken: token } });
  if (!user) return { ok: false, errorKey: 'auth.error.invite' };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      passwordSetAt: new Date(),
      inviteToken: null,
    },
  });
  await createSession(user.id);
  redirect('/');
}

/**
 * Changing your own password.
 *
 * The current one is asked for even though the session already proves who you are: it is
 * what stops an unlocked screen from becoming a locked-out account. Nobody else can do
 * this for you — an admin can only issue a fresh invitation link, which is visible as
 * what it is.
 */
export async function changePassword(
  _state: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const { user } = await requireUser();

  const current = String(formData.get('current') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (!current || !password) return { ok: false, errorKey: 'auth.error.missing' };
  if (password !== confirm) return { ok: false, errorKey: 'auth.error.mismatch' };

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!(await verifyPassword(current, record?.passwordHash ?? null))) {
    return { ok: false, errorKey: 'auth.error.currentWrong' };
  }
  if (await verifyPassword(password, record?.passwordHash ?? null)) {
    return { ok: false, errorKey: 'auth.error.samePassword' };
  }

  const rule = checkPassword(password);
  if (!rule.ok) return { ok: false, errorKey: rule.reasonKey };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), passwordSetAt: new Date() },
  });
  await revokeOtherSessions(user.id);

  revalidatePath('/', 'layout');
  return { ok: true };
}

import { prisma } from '@/services/db/client';
import { hashPassword } from './password';

/**
 * Panel state on boot: whether anyone can sign in yet, and whether setup is finished.
 * The first owner comes from the environment, so a fresh container has a way in.
 */
export interface PanelState {
  hasUsers: boolean;
  initialized: boolean;
  ownerEmail: string | null;
}

export async function ensureOwner(): Promise<void> {
  const count = await prisma.user.count();
  if (count > 0) return;

  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  if (!email || !password) return;

  await prisma.user.create({
    data: {
      email,
      name: process.env.OWNER_NAME?.trim() || email,
      claudeRef: email,
      passwordHash: await hashPassword(password),
      globalRole: 'OWNER',
    },
  });
}

export async function panelState(): Promise<PanelState> {
  const [count, panel, owner] = await Promise.all([
    prisma.user.count(),
    prisma.panel.findUnique({ where: { id: 'panel' } }),
    prisma.user.findFirst({ where: { globalRole: 'OWNER' }, select: { email: true } }),
  ]);
  return {
    hasUsers: count > 0,
    initialized: Boolean(panel?.initializedAt),
    ownerEmail: owner?.email ?? null,
  };
}

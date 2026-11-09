'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/services/db/client';
import { requireUser } from '@/services/auth/context';
import { setRail } from '@/services/panel/rail';
import type { Rail } from '@/services/panel/rail';
import type { Direction, Locale, ThemeChoice } from '@/services/workspace/types';

/** A person's language is theirs; the look belongs to the panel. */
export async function setLocale(locale: Locale): Promise<void> {
  const { user } = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { locale } });
  revalidatePath('/', 'layout');
}

export async function setAppearance(direction: Direction, theme: ThemeChoice): Promise<void> {
  await requireUser();
  await prisma.panel.upsert({
    where: { id: 'panel' },
    update: { direction, theme },
    create: { id: 'panel', direction, theme },
  });
  revalidatePath('/', 'layout');
}

export async function setDirection(direction: Direction): Promise<void> {
  await setAppearance(direction, direction === 'b' ? 'light' : 'dark');
}

export async function setTheme(theme: ThemeChoice): Promise<void> {
  const panel = await prisma.panel.findUnique({ where: { id: 'panel' } });
  await setAppearance((panel?.direction ?? 'a') as Direction, theme);
}

export async function toggleRail(rail: Rail): Promise<void> {
  await setRail(rail);
  revalidatePath('/', 'layout');
}

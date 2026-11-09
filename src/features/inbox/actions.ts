'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/services/auth/context';
import { markAllRead, markRead } from '@/services/panel/inbox';

export async function readItem(id: string): Promise<void> {
  const { user } = await requireUser();
  await markRead(user.id, id);
  revalidatePath('/inbox');
  revalidatePath('/', 'layout');
}

export async function readAll(): Promise<void> {
  const { user } = await requireUser();
  await markAllRead(user.id);
  revalidatePath('/inbox');
  revalidatePath('/', 'layout');
}

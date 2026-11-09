'use server';

import { revalidatePath } from 'next/cache';
import { saveWorkspace } from '@/services/store/store';
import { seedDemo } from '@/services/relays/service';
import { environment } from '@/services/workspace/connect';
import type { EnvironmentCheck } from '@/services/workspace/connect';
import type { Workspace } from '@/services/workspace/types';

export async function setNotifications(
  notifications: Partial<Workspace['notifications']>,
): Promise<void> {
  await saveWorkspace({ notifications });
  revalidatePath('/settings');
}

export async function resetSampleWorkspace(): Promise<void> {
  await seedDemo();
  revalidatePath('/', 'layout');
}

export async function runDiagnostics(path?: string): Promise<EnvironmentCheck[]> {
  return environment(path);
}

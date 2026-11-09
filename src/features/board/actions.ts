'use server';

import { revalidatePath } from 'next/cache';
import { getWorkspace, saveWorkspace } from '@/services/store/store';
import { requireUser } from '@/services/auth/context';
import { ensureHubCopy } from '@/services/workspace/hub-cache';

/**
 * Fetch the hub now rather than on the next TTL. The board offers this whenever the
 * packages could not be read, because "try again" is the only useful answer to a failed
 * clone the user can give.
 */
export async function refreshHub(): Promise<{ ok: boolean; error?: string }> {
  const workspace = await getWorkspace();
  if (!workspace.hub) return { ok: false, error: 'no hub is connected' };

  const { user } = await requireUser();
  const copy = await ensureHubCopy(workspace.hub, { force: true, userId: user.id });
  if (copy.fetchedAt) {
    await saveWorkspace({ hub: { ...workspace.hub, lastFetch: copy.fetchedAt } });
  }
  revalidatePath('/', 'layout');
  return { ok: Boolean(copy.path) && !copy.error, error: copy.error };
}

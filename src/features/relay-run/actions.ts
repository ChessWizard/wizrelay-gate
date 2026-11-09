'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { allRelays } from '@/services/relays/service';
import { deleteRelay } from '@/services/store/store';

/**
 * Remove a relay that exists only in this dashboard — an intake that was never published.
 * Refused for anything the hub still carries, because that would come straight back on
 * the next scan and look like the removal failed.
 */
export async function removeLocalRelay(id: string): Promise<{ ok: boolean; reason?: string }> {
  const relays = await allRelays();
  const relay = relays.find((candidate) => candidate.id === id);
  if (!relay) return { ok: false, reason: 'no-relay' };
  if (!relay.localOnly) return { ok: false, reason: 'in-hub' };

  await deleteRelay(id);
  revalidatePath('/', 'layout');
  redirect('/');
}

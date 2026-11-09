'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/services/auth/context';
import { cancelPairing, openPairing, revokeAgent } from '@/services/agent/registry';

/**
 * Pairing, from the panel's side.
 *
 * The code is returned to the browser once and never stored in a form anyone can read
 * back: the row keeps only its HMAC. Closing the card without using it costs nothing,
 * because a new one replaces it.
 */
export async function newPairingCode(): Promise<{ code: string; expiresAt: string }> {
  const { user } = await requireUser();
  const offer = await openPairing(user.id);
  revalidatePath('/connections');
  return { code: offer.code, expiresAt: offer.expiresAt.toISOString() };
}

export async function dropPairingCode(): Promise<void> {
  const { user } = await requireUser();
  await cancelPairing(user.id);
  revalidatePath('/connections');
}

/**
 * Stop trusting a machine.
 *
 * The token stays valid nowhere: the agent's next call is answered with 401 and it says
 * so on its own console, which is the behaviour somebody wants when a laptop is lost.
 */
export async function removeAgent(agentId: string): Promise<boolean> {
  const { user } = await requireUser();
  const revoked = await revokeAgent(user.id, agentId);
  revalidatePath('/connections');
  revalidatePath('/settings');
  return revoked;
}

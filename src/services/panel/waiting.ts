import type { GateId } from '@/core/gates/gates';
import { notify } from './inbox';

/**
 * A gate has stopped and is waiting for a person.
 *
 * This is the one state the panel cannot resolve by itself, and the one a pipeline hides
 * best: a run that is waiting looks exactly like a run that is working until somebody
 * opens it. The notice says which task and which gate, and links to the console that is
 * asking, so the answer is one click from wherever the person happens to be.
 *
 * It never throws into the run. A notice that failed to be written is a worse day for
 * somebody; a gate that died because a notice failed is a worse day for everybody.
 */
export async function notifyWaiting(input: {
  userId: string | null;
  relayId: string;
  role?: string;
  gate: GateId;
  question: string;
}): Promise<void> {
  if (!input.userId) return;
  try {
    await notify({
      userId: input.userId,
      kind: 'QUESTION',
      relayId: input.relayId,
      title: input.relayId,
      body: input.question,
      href: `/relay/${input.relayId}/gate/${input.gate}/console${
        input.role ? `?role=${encodeURIComponent(input.role)}` : ''
      }`,
    });
  } catch {
  }
}

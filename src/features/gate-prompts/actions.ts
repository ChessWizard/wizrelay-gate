'use server';

import { revalidatePath } from 'next/cache';
import type { GateId } from '@/core/gates/gates';
import { answerPrompt, startGate, startTrack, stopGate } from '@/services/engine/runner';
import { guardGate, guardTrack } from '@/services/panel/guard';
import { record } from '@/services/panel/activity';
import { notify } from '@/services/panel/inbox';
import { prisma } from '@/services/db/client';
import { requireUser } from '@/services/auth/context';
import { EVERY_RELAY, approvalChoice, setApproval } from '@/services/engine/approval';

export interface AnswerInput {
  relayId: string;
  role?: string;
  gate: GateId;
  promptId: string;
  optionId?: string;
  text?: string;
  files?: { name: string; size: number }[];
}

/**
 * Answering is the one write that must never be lost, so it is recorded before anything
 * continues. The answer then picks the branch the gate takes.
 */
export async function submitAnswer(input: AnswerInput): Promise<{ ok: boolean; reason?: string }> {
  const guard = await guardGate(input.gate, input.role);
  if (!guard.allowed) return { ok: false, reason: guard.reasonKey };

  const result = await answerPrompt(
    input.relayId,
    input.role,
    input.gate,
    input.promptId,
    {
      promptId: input.promptId,
      optionId: input.optionId,
      text: input.text,
      files: input.files,
    },

    guard.userId,
  );

  if (result.ok) {
    await record({
      kind: 'PROMPT_ANSWERED',
      userId: guard.userId,
      projectId: guard.project?.id,
      hubId: guard.hubId,
      relayId: input.relayId,
      gate: input.gate,
      summary: input.optionId ?? input.text?.slice(0, 120) ?? '',
    });
  }

  revalidatePath(`/relay/${input.relayId}`);
  revalidatePath('/');
  return result;
}

export async function runGate(input: {
  relayId: string;
  role?: string;
  gate: GateId;
  message?: string;
  /** One planned step of the gate, rather than the whole gate. */
  only?: string;
}): Promise<{ started: boolean; reason?: string }> {
  const guard = await guardGate(input.gate, input.role);
  if (!guard.allowed) return { started: false, reason: guard.reasonKey };

  const result = await startGate({ ...input, userId: guard.userId });

  revalidatePath(`/relay/${input.relayId}`);
  revalidatePath('/');
  return result;
}

/**
 * Run a whole track. It returns once the chain stops — at the end, at a failure, or at a
 * question — so the screen that called it is current when it comes back.
 */
export async function runTrack(input: {
  relayId: string;
  role?: string;
  track: 'research' | 'delivery';
}): Promise<{ started: boolean; ran: string[]; stoppedAt?: string; reason?: string }> {
  const guard = await guardTrack(input.track, input.role);
  if (!guard.allowed) return { started: false, ran: [], reason: guard.reasonKey };

  const result = await startTrack({ ...input, userId: guard.userId });

  if (result.stoppedAt && guard.project?.researchLeadId) {
    const lead = await prisma.user.findUnique({ where: { id: guard.project.researchLeadId } });
    if (lead && lead.id !== guard.userId) {
      await notify({
        userId: lead.id,
        projectId: guard.project.id,
        kind: 'QUESTION',
        relayId: input.relayId,
        title: input.relayId,
        body: result.stoppedAt,
        href: `/relay/${input.relayId}?role=${input.role ?? ''}&gate=${result.stoppedAt}`,
      });
    }
  }

  revalidatePath(`/relay/${input.relayId}`);
  revalidatePath('/');
  return result;
}

export async function haltGate(input: {
  relayId: string;
  role?: string;
  gate: GateId;
}): Promise<boolean> {
  const stopped = stopGate(input.relayId, input.role, input.gate);
  revalidatePath(`/relay/${input.relayId}`);
  return stopped;
}

/**
 * Stop asking this person before a commit, or before a push, or both.
 *
 * It reads what they already have and adds to it rather than replacing it: somebody who
 * stopped being asked about commits last week and chooses it for pushes today should not
 * silently get the commits question back.
 */
export async function stopAsking(input: {
  relayId: string;
  scope: 'relay' | 'all';
  kindOf: 'commit' | 'push';
}): Promise<void> {
  const { user } = await requireUser();
  const relayId = input.scope === 'all' ? EVERY_RELAY : input.relayId;
  const current = await approvalChoice(user.id, relayId || input.relayId);

  await setApproval({
    userId: user.id,
    relayId,
    commits: current.commits || input.kindOf === 'commit',
    pushes: current.pushes || input.kindOf === 'push',
  });

  revalidatePath(`/relay/${input.relayId}`);
  revalidatePath('/settings');
}

/** Put one of those questions back, from the screen that lists them. */
export async function resumeAsking(relayId: string): Promise<void> {
  const { user } = await requireUser();
  await setApproval({ userId: user.id, relayId, commits: false, pushes: false });
  revalidatePath('/settings');
}

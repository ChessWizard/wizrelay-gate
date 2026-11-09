import type { StepApproval } from '@/core/gates/steps';
import { prisma } from '@/services/db/client';

/**
 * Who has stopped being asked, and about what.
 *
 * Asking before a commit or a push is the default and stays the default. The question is
 * not ceremony: those two steps leave the machine, carry a person's name into a history
 * other people read, and are the only part of a gate the panel cannot undo. A pipeline
 * that does them unattended is one nobody is accountable for.
 *
 * But somebody running the same flow twenty times a day is not consenting any more, they
 * are clicking. So the asking can be switched off — per relay or across all of theirs —
 * and it binds to that person alone. There is deliberately no setting that lets one
 * person stop another from being asked, and none that an admin can set on their behalf:
 * the whole value of the question is that the person who answers it is the person whose
 * name the commit carries.
 */

/** The rule that covers every relay this person touches. */
export const EVERY_RELAY = '';

export interface ApprovalChoice {
  commits: boolean;
  pushes: boolean;
}

export const ALWAYS_ASK: ApprovalChoice = { commits: false, pushes: false };

/**
 * The rule that applies to this run.
 *
 * A rule for the relay wins over the blanket one, including when it is narrower: somebody
 * who allows commits everywhere but wants to be asked on one delicate task sets that task
 * explicitly and gets asked.
 */
export async function approvalChoice(
  userId: string | null | undefined,
  relayId: string,
): Promise<ApprovalChoice> {
  if (!userId) return ALWAYS_ASK;

  const rules = await prisma.autoApproval.findMany({
    where: { userId, relayId: { in: [relayId, EVERY_RELAY] } },
  });
  const forRelay = rules.find((rule) => rule.relayId === relayId);
  const blanket = rules.find((rule) => rule.relayId === EVERY_RELAY);
  const chosen = forRelay ?? blanket;
  return chosen ? { commits: chosen.commits, pushes: chosen.pushes } : ALWAYS_ASK;
}

/** Whether this particular step may run without stopping to ask. */
export function preApproved(choice: ApprovalChoice, approval: StepApproval): boolean {
  if (approval === 'commit') return choice.commits;
  if (approval === 'push') return choice.pushes;
  return false;
}

export async function setApproval(input: {
  userId: string;
  /** `EVERY_RELAY` for the blanket rule. */
  relayId: string;
  commits: boolean;
  pushes: boolean;
}): Promise<void> {
  if (!input.commits && !input.pushes) {
    await prisma.autoApproval.deleteMany({ where: { userId: input.userId, relayId: input.relayId } });
    return;
  }

  await prisma.autoApproval.upsert({
    where: { userId_relayId: { userId: input.userId, relayId: input.relayId } },
    update: { commits: input.commits, pushes: input.pushes },
    create: {
      userId: input.userId,
      relayId: input.relayId,
      commits: input.commits,
      pushes: input.pushes,
    },
  });
}

export interface ApprovalRules {
  blanket: ApprovalChoice | null;
  perRelay: { relayId: string; commits: boolean; pushes: boolean }[];
}

/** Everything this person has switched off, for the screen that lets them switch it back. */
export async function approvalRules(userId: string): Promise<ApprovalRules> {
  const rules = await prisma.autoApproval.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  const blanket = rules.find((rule) => rule.relayId === EVERY_RELAY);
  return {
    blanket: blanket ? { commits: blanket.commits, pushes: blanket.pushes } : null,
    perRelay: rules
      .filter((rule) => rule.relayId !== EVERY_RELAY)
      .map((rule) => ({ relayId: rule.relayId, commits: rule.commits, pushes: rule.pushes })),
  };
}

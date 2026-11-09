import type { Question } from '@/core/relay/types';
import { normaliseHandle } from './mentions';

/**
 * Who a question belongs to.
 *
 * Every question used to appear on everyone's screen, which sounds open and is the
 * opposite: a list where most items are somebody else's is a list nobody reads, and the
 * question that was actually blocking a task sat in it unanswered. A question has an
 * addressee now, and the people who are not it do not see it.
 *
 * The order here is the order of certainty. Somebody named is named. Failing that the
 * project's research lead owns it, because an unaddressed question is not nobody's —
 * somebody decided it was worth asking, and research is where it lands. The person who
 * asked always keeps sight of their own question.
 */
export interface Audience {
  /** The handles it is addressed to, after the fallback has been applied. */
  to: string[];
  /** The handle that raised it, if the package says. */
  from?: string;
  /** True when nobody was named and the research lead inherited it. */
  inherited: boolean;
}

export function questionAudience(
  question: Pick<Question, 'askedBy' | 'askedOf'>,
  researchLead?: string | null,
): Audience {
  const named = (question.askedOf ?? []).map(normaliseHandle).filter(Boolean);
  const lead = researchLead ? normaliseHandle(researchLead) : '';

  if (named.length > 0) {
    return { to: [...new Set(named)], from: question.askedBy, inherited: false };
  }
  return {
    to: lead ? [lead] : [],
    from: question.askedBy,
    inherited: Boolean(lead),
  };
}

export interface QuestionViewer {
  handle: string;
  /** Owners and admins administer the panel; nothing is hidden from them. */
  administers: boolean;
}

/** Whether this person may read the question at all. */
export function canSeeQuestion(viewer: QuestionViewer, audience: Audience): boolean {
  if (viewer.administers) return true;
  const handle = normaliseHandle(viewer.handle);
  if (!handle) return false;
  if (audience.from && normaliseHandle(audience.from) === handle) return true;
  return audience.to.some((entry) => normaliseHandle(entry) === handle);
}

/**
 * Whether the question is waiting on this person.
 *
 * Not the same as seeing it: the person who asked watches their own question without
 * owing an answer to it, and an admin reads every question without owing one either.
 */
export function isWaitingOn(viewer: QuestionViewer, audience: Audience): boolean {
  const handle = normaliseHandle(viewer.handle);
  if (!handle) return false;
  return audience.to.some((entry) => normaliseHandle(entry) === handle);
}

/**
 * A question nobody can answer.
 *
 * No addressee and no research lead: it will sit there until somebody notices. The panel
 * says so instead of filing it where only an admin will ever look.
 */
export function isUnrouted(audience: Audience): boolean {
  return audience.to.length === 0;
}

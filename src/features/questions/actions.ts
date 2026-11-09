'use server';

import { revalidatePath } from 'next/cache';
import { questionAudience } from '@/core/packages/audience';
import { requireUser } from '@/services/auth/context';
import { loadQuestions } from '@/services/relays/service';
import { askOnTracker } from '@/services/questions/routing';
import { record } from '@/services/panel/activity';
import { getWorkspace } from '@/services/store/store';
import { createTranslator } from '@/shared/i18n/translate';

export interface AskState {
  ok?: boolean;
  errorKey?: string;
}

/**
 * Ask the question where the person who can answer it already is.
 *
 * It goes through `loadQuestions` rather than taking the question from the form, so the
 * same access rule that decides what somebody can see decides what they can send: a
 * question you cannot read is not one you can put on a card.
 */
export async function askOnTrackerAction(
  relayId: string,
  questionId: string,
): Promise<AskState> {
  const { user } = await requireUser();

  const all = await loadQuestions();
  const item = all.find(
    (candidate) => candidate.relay.id === relayId && candidate.question.id === questionId,
  );
  if (!item) return { errorKey: 'error.forbidden' };

  const workspace = await getWorkspace();
  const t = createTranslator(workspace.locale);

  const result = await askOnTracker({
    userId: user.id,
    question: item.question,
    audience: item.audience.to.length ? item.audience : questionAudience(item.question, null),
    relayId,
    role: item.question.role,
    t,
  });

  if (!result.ok) return { errorKey: result.reasonKey ?? 'questions.askFailed' };

  await record({
    userId: user.id,
    kind: 'QUESTION_ASKED',
    relayId,
    summary: `${questionId} · ${item.question.title}`,
  }).catch(() => undefined);

  revalidatePath('/questions');
  return { ok: true };
}

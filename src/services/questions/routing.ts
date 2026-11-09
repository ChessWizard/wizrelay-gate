import type { Question } from '@/core/relay/types';
import type { Audience } from '@/core/packages/audience';
import type { TrackerReply } from '@/core/tracker/questions';
import { alreadyPosted, questionComment, repliesTo } from '@/core/tracker/questions';
import { getComments, listMembers, postComment } from '@/services/integrations/clickup';
import type { Translator } from '@/shared/i18n/translate';

/** A ClickUp id as the tracker wants it: `CU-86c1abcd` is `86c1abcd` on the card. */
function cardId(relayId: string): string {
  return relayId.replace(/^CU-/i, '');
}

export interface QuestionThread {
  /** The panel has asked this on the card already. */
  posted: boolean;
  replies: TrackerReply[];
}

const EMPTY: QuestionThread = { posted: false, replies: [] };

/**
 * What the card says about each of a task's questions.
 *
 * One read per card, however many questions it carries: the comments are all in the same
 * place and splitting them between questions is arithmetic. Asking per question would
 * mean five HTTP round trips to render one screen.
 *
 * Read rather than stored: the tracker is the record, and a copy in this panel's database
 * would be a second truth that goes stale the first time somebody edits their comment
 * there. A tracker that is unreachable gives empty threads, never an error — the
 * questions are still the questions.
 */
export async function threadsFor(
  userId: string,
  relayId: string,
  questionIds: string[],
): Promise<Map<string, QuestionThread>> {
  const threads = new Map<string, QuestionThread>();
  if (questionIds.length === 0) return threads;

  const comments = await getComments(userId, cardId(relayId)).catch(() => []);
  if (comments.length === 0) {
    for (const id of questionIds) threads.set(id, EMPTY);
    return threads;
  }

  const asReplies: TrackerReply[] = comments.map((comment) => ({
    id: comment.id,
    text: comment.text,
    user: comment.user,
    at: comment.at,
  }));

  for (const id of questionIds) {
    threads.set(id, { posted: alreadyPosted(id, asReplies), replies: repliesTo(id, asReplies) });
  }
  return threads;
}

/** One question's thread, for the paths that only have one. */
export async function questionThread(
  userId: string,
  relayId: string,
  questionId: string,
): Promise<QuestionThread> {
  return (await threadsFor(userId, relayId, [questionId])).get(questionId) ?? EMPTY;
}

export interface AskResult {
  ok: boolean;
  reasonKey?: 'questions.noTracker' | 'questions.askFailed' | 'questions.alreadyAsked';
}

/**
 * Put the question on the card.
 *
 * The addressee is assigned where the tracker knows them by the same address the question
 * used, so it arrives as a task rather than as a notification somebody may or may not
 * read. Where it does not know them the comment still names them in its first line, which
 * is what most trackers turn into a mention anyway.
 */
export async function askOnTracker(input: {
  userId: string;
  question: Question;
  audience: Audience;
  relayId: string;
  role?: string;
  url?: string;
  t: Translator;
}): Promise<AskResult> {
  const { userId, question, audience, relayId, role, url, t } = input;

  const thread = await questionThread(userId, relayId, question.id);
  if (thread.posted) return { ok: false, reasonKey: 'questions.alreadyAsked' };

  const members = await listMembers(userId).catch(() => []);
  const assignee = members.find((member) => audience.to.includes(member.email.toLowerCase()))?.id;

  const text = questionComment({
    questionId: question.id,
    title: question.title,
    body: question.body,
    to: audience.to,
    from: audience.from,
    relayId,
    role,
    url,
    lines: {
      askedBy: t('questions.askedBy'),
      reply: t('questions.replyHere'),
      task: t('board.column.task'),
    },
  });

  const sent = await postComment(userId, cardId(relayId), text, assignee);
  return sent ? { ok: true } : { ok: false, reasonKey: 'questions.askFailed' };
}

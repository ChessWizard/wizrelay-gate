/**
 * A question's round trip through the tracker.
 *
 * The person who can answer a research question is often not in this panel: they are on
 * the card, in the tracker everybody already watches. Asking them to come here to answer
 * is how a question goes unanswered for a week. So the question goes to them, in the
 * place they are, and their reply is read back out of it.
 *
 * The marker is what makes it a loop rather than two unrelated conversations. It is in
 * the posted comment's first line, it names the question, and it is how the panel later
 * tells its own comment from an answer to it — a tracker gives no thread id that survives
 * the trip, so the text has to carry its own identity.
 */

export const MARK = 'wizrelay';

const HEAD = new RegExp(`^\\s*\\[${MARK}\\s+(Q-\\d+)\\]`, 'i');

export interface QuestionPost {
  questionId: string;
  title: string;
  body?: string;
  /** Handles the question is addressed to, written into the comment so they are notified. */
  to: string[];
  from?: string;
  relayId: string;
  role?: string;
  /** Where to answer it in the panel, for people who would rather answer here. */
  url?: string;
  lines: {
    askedBy: string;
    reply: string;
    task: string;
  };
}

/**
 * The comment the panel posts.
 *
 * Addressees first, because a tracker turns a leading address into a notification and
 * that notification is the entire point. Everything after is for the person reading it
 * cold: what is being asked, who wants to know, and the two ways to answer.
 */
export function questionComment(post: QuestionPost): string {
  const lines: string[] = [];
  lines.push(`[${MARK} ${post.questionId}] ${post.to.map((handle) => `@${handle}`).join(' ')}`.trim());
  lines.push('');
  lines.push(post.title);
  if (post.body) {
    lines.push('');
    lines.push(post.body);
  }
  lines.push('');
  if (post.from) lines.push(`${post.lines.askedBy}: @${post.from}`);
  lines.push(`${post.lines.task}: ${post.relayId}${post.role ? ` · ${post.role}` : ''}`);
  lines.push(post.lines.reply);
  if (post.url) lines.push(post.url);
  return lines.join('\n');
}

/** Whether this comment is one the panel wrote, and for which question. */
export function postedQuestion(text: string): string | null {
  const match = HEAD.exec(text ?? '');
  return match ? match[1].toUpperCase() : null;
}

export interface TrackerReply {
  id: string;
  text: string;
  user: string;
  at: string;
}

/**
 * The replies to a question, in the order they were written.
 *
 * A reply is any comment that names the question and is not the panel's own posting of
 * it. Naming it is enough: people reply by quoting `Q-012`, and asking them to use a
 * particular syntax is asking them not to answer.
 */
export function repliesTo(questionId: string, comments: TrackerReply[]): TrackerReply[] {
  const id = questionId.toUpperCase();
  const named = new RegExp(`\\b${id.replace('-', '\\-')}\\b`, 'i');

  return comments.filter((comment) => {
    const text = comment.text ?? '';
    if (postedQuestion(text)) return false;
    return named.test(text);
  });
}

/** Whether the panel has already asked this question on the card. */
export function alreadyPosted(questionId: string, comments: TrackerReply[]): boolean {
  const id = questionId.toUpperCase();
  return comments.some((comment) => postedQuestion(comment.text ?? '') === id);
}

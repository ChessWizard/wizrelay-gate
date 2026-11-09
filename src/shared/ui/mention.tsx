import type { ReactNode } from 'react';
import { splitMentions } from '@/core/packages/mentions';
import { Icon } from './icons';

/**
 * Text with `@somebody` in it.
 *
 * The mention is the part that matters — it is who the sentence is aimed at — so it is
 * set apart from the prose around it rather than left as a run of characters the eye
 * slides over. Everything else is rendered exactly as written.
 */
export function WithMentions({ text }: { text: string }): ReactNode {
  const parts = splitMentions(text);
  if (parts.length === 1 && !parts[0].handle) return text;

  return (
    <>
      {parts.map((part, index) =>
        part.handle ? (
          <span className="mention" key={index}>
            {part.text}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** One addressee, as a chip. `name` is shown when the panel knows who the handle is. */
export function MentionChip({
  handle,
  name,
  muted,
}: {
  handle: string;
  name?: string;
  muted?: boolean;
}) {
  return (
    <span className={muted ? 'mention-chip is-muted' : 'mention-chip'} title={handle}>
      <Icon name="user" />
      {name ?? `@${handle}`}
    </span>
  );
}

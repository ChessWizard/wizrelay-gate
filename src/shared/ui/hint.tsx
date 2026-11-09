'use client';

import { useId, useState } from 'react';
import { Icon } from './icons';

/**
 * A short explanation, parked next to the thing it explains.
 *
 * The panel is full of words that mean something specific in wizrelay — a tier, a
 * verdict, the routing policy — and a reader who does not already know cannot tell a
 * jargon term from an ordinary one. This marks them and says what they mean, without
 * spending a paragraph of the screen on readers who already know.
 *
 * Hover opens it, and so does focus, so it is reachable from the keyboard; click toggles
 * it, which is the only thing that works on a touch screen.
 */
export function Hint({
  title,
  children,
  align = 'start',
}: {
  title?: string;
  children: string;
  /** `end` for a hint at the right edge of its row, so the bubble opens inward. */
  align?: 'start' | 'end';
}) {
  const id = useId();
  const [pinned, setPinned] = useState(false);

  return (
    <span
      className={align === 'end' ? 'hint hint-end' : 'hint'}
      data-pinned={pinned ? 'true' : undefined}
    >
      <button
        type="button"
        className="hint-dot"
        aria-describedby={id}
        aria-expanded={pinned}
        aria-label={title ?? children}
        onClick={() => setPinned((value) => !value)}
      >
        <Icon name="help" size={16} />
      </button>
      <span className="hint-pop" id={id} role="tooltip">
        {title ? <span className="hint-title">{title}</span> : null}
        <span className="hint-body">{children}</span>
      </span>
    </span>
  );
}

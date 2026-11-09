'use client';

import { useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, RefObject } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { cn } from '@/shared/lib/cn';
import { Icon } from './icons';

export interface MentionCandidate {
  handle: string;
  name: string;
  source: 'panel' | 'tracker';
}

/** The `@word` being typed right now, if the caret is inside one. */
function activeMention(value: string, caret: number): { from: number; query: string } | null {
  const before = value.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;

  const preceding = at === 0 ? '' : before[at - 1];
  if (preceding && !/[\s(\[{<,;:"']/.test(preceding)) return null;

  const query = before.slice(at + 1);
  if (/\s/.test(query)) return null;
  return { from: at, query: query.toLowerCase() };
}

/**
 * Typing somebody's name into a question.
 *
 * The panel knows who everybody is, so asking a person to remember an address — and to
 * get it right, in a file that routes on it — is work it can do for them. `@` offers the
 * people who can be named: everybody here, and everybody in the connected tracker, which
 * is where the person who actually knows the answer often is.
 *
 * It stays a plain textarea underneath. A rich editor would own the text, and this text
 * goes into a Markdown file somebody else will read as Markdown.
 */
export function MentionBox({
  value,
  onChange,
  people,
  rows = 3,
  placeholder,
  id,
  name,
  disabled,
  onKeyDown,
  textareaRef,
}: {
  value: string;
  onChange: (next: string) => void;
  people: MentionCandidate[];
  rows?: number;
  placeholder?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const t = useTranslator();
  const own = useRef<HTMLTextAreaElement | null>(null);
  const box = textareaRef ?? own;
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);

  const active = activeMention(value, caret);
  const matches = active
    ? people
        .filter(
          (person) =>
            person.handle.includes(active.query) || person.name.toLowerCase().includes(active.query),
        )
        .slice(0, 6)
    : [];
  const open = matches.length > 0;

  const insert = (person: MentionCandidate) => {
    if (!active) return;
    const next = `${value.slice(0, active.from)}@${person.handle} ${value.slice(caret)}`;
    onChange(next);
    setHighlight(0);

    const at = active.from + person.handle.length + 2;
    requestAnimationFrame(() => {
      box.current?.focus();
      box.current?.setSelectionRange(at, at);
      setCaret(at);
    });
  };

  const track = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
    setCaret(event.target.selectionStart ?? event.target.value.length);
    setHighlight(0);
  };

  return (
    <div className="mention-box">
      <textarea
        id={id}
        name={name}
        ref={box}
        rows={rows}
        className="input"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={track}
        onClick={(event) => setCaret(event.currentTarget.selectionStart ?? 0)}
        onKeyUp={(event) => setCaret(event.currentTarget.selectionStart ?? 0)}
        onKeyDown={(event) => {
          if (open) {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setHighlight((index) => (index + 1) % matches.length);
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setHighlight((index) => (index - 1 + matches.length) % matches.length);
              return;
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
              event.preventDefault();
              insert(matches[highlight]);
              return;
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setCaret(-1);
              return;
            }
          }
          onKeyDown?.(event);
        }}
      />

      {open ? (
        <div className="mention-pop" role="listbox" aria-label={t('mention.people')}>
          {matches.map((person, index) => (
            <button
              key={person.handle}
              type="button"
              className={cn('it', index === highlight && 'is-on')}
              role="option"
              aria-selected={index === highlight}
              onMouseDown={(event) => {
                event.preventDefault();
                insert(person);
              }}
            >
              <span className="n">{person.name}</span>
              <span className="h">@{person.handle}</span>
              <span className={cn('s', person.source === 'tracker' && 'is-tracker')}>
                <Icon name={person.source === 'tracker' ? 'external' : 'user'} />
                {t(person.source === 'tracker' ? 'mention.tracker' : 'mention.panel')}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

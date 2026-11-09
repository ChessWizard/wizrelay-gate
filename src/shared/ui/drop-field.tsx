'use client';

import { useId, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { Icon } from './icons';

/**
 * Where a file goes.
 *
 * The browser's own file control is a grey button and the words "no file selected", and
 * it says nothing about what belongs there, what sizes are allowed, or that you could
 * simply drag the thing in. It is also the one control on a page that never matches the
 * design around it, because it cannot be styled at all.
 *
 * So the real input stays — it is what the form submits, and it is what a keyboard and a
 * screen reader use — and it is made invisible over a target that can be clicked, dropped
 * onto, or reached with Tab. Everything visible here is a label; nothing reimplements
 * file selection, which is the part that would break.
 */
export function DropField({
  name,
  accept,
  /** What belongs here, in one line. */
  hint,
  /** The name of what is already chosen, when anything is. */
  chosen,
  onPick,
  disabled,
}: {
  name: string;
  accept?: string;
  hint?: string;
  chosen?: string | null;
  onPick: (file: File | null) => void;
  disabled?: boolean;
}) {
  const t = useTranslator();
  const id = useId();
  const input = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);

  const take = (file: File | null) => {
    if (!file || !input.current) return;
    const carrier = new DataTransfer();
    carrier.items.add(file);
    input.current.files = carrier.files;
    onPick(file);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setOver(false);
    if (disabled) return;
    take(event.dataTransfer.files?.[0] ?? null);
  };

  return (
    <label
      htmlFor={id}
      className={`drop${over ? ' is-over' : ''}${chosen ? ' is-filled' : ''}${disabled ? ' is-off' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <input
        ref={input}
        id={id}
        name={name}
        type="file"
        accept={accept}
        className="drop-input"
        disabled={disabled}
        onChange={(event) => onPick(event.target.files?.[0] ?? null)}
      />
      <Icon name={chosen ? 'passed' : 'upload'} className="drop-icon" />
      <span className="drop-main">{chosen ?? t('drop.invite')}</span>
      {hint ? <span className="drop-hint">{hint}</span> : null}
    </label>
  );
}

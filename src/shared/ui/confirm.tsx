'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { Button } from './primitives';
import type { ButtonVariant } from './primitives';
import type { IconName } from './icons';

/**
 * A destructive action, armed before it fires.
 *
 * The first click asks, the second does it, and anything else — a click elsewhere, the
 * escape key, five seconds of nothing — disarms it. No dialog: the question belongs next
 * to the row it is about, not in front of the whole screen.
 */
export function ConfirmButton({
  onConfirm,
  label,
  confirmLabel,
  icon = 'trash',
  variant = 'ghost',
  size = 'sm',
  disabled,
  note,
}: {
  onConfirm: () => Promise<unknown>;
  label: string;
  confirmLabel?: string;
  icon?: IconName;
  variant?: ButtonVariant;
  size?: 'sm' | 'default';
  disabled?: boolean;
  note?: string;
}) {
  const t = useTranslator();
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  const root = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 5000);
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setArmed(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setArmed(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [armed]);

  if (!armed) {
    return (
      <span ref={root} className="confirm">
        <Button
          type="button"
          variant={variant}
          size={size}
          icon={icon}
          disabled={disabled || pending}
          onClick={() => setArmed(true)}
        >
          {label}
        </Button>
      </span>
    );
  }

  return (
    <span ref={root} className="confirm is-armed">
      {note ? <span className="xs t3 confirm-note">{note}</span> : null}
      <Button
        type="button"
        variant="danger"
        size={size}
        icon={icon}
        disabled={pending}
        onClick={() => {
          setArmed(false);
          start(() => void onConfirm());
        }}
      >
        {confirmLabel ?? t('common.confirm')}
      </Button>
      <Button type="button" variant="ghost" size={size} onClick={() => setArmed(false)}>
        {t('common.cancel')}
      </Button>
    </span>
  );
}

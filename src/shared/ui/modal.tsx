'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslator } from '@/shared/i18n/provider';
import { Icon } from './icons';

/**
 * A dialog, for the handful of things that genuinely are one.
 *
 * Most of this panel refuses modals: a question belongs next to the thing it is about,
 * and a dialog that interrupts somebody to ask them something they could have answered in
 * place is an imposition. Two cases earn it. Reading something dense at the size of the
 * screen, where the point is to see nothing else. And a form with enough parts that
 * filling it in a table row would mean a row taller than the table — an invitation, which
 * carries an address, a name, a panel role and a decision per project.
 *
 * It is rendered into `document.body` so no ancestor's `overflow` or stacking context can
 * clip it, closes on Escape and on the backdrop, and locks the page behind it so the
 * wheel scrolls the dialog rather than the thing it is covering.
 */
export function Modal({
  open,
  onClose,
  title,
  note,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  note?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const t = useTranslator();
  const closer = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    closer.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="overlay expand-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`dialog expand-dialog ${wide ? 'is-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        <div className="panel-h">
          <div className="row" style={{ gap: '10px', minWidth: 0 }}>
            <span className="strong trunc">{title}</span>
            {note ? <span className="xs t3 trunc">{note}</span> : null}
          </div>
          <button
            type="button"
            className="expand-btn"
            ref={closer}
            onClick={onClose}
            title={t('expand.close')}
            aria-label={t('expand.close')}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="expand-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

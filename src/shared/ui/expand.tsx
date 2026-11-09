'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslator } from '@/shared/i18n/provider';
import { Icon } from './icons';

/**
 * Read this properly.
 *
 * Several panels here hold a document's worth of material in a column the layout can
 * spare: a 25-criterion acceptance list, a scope with forty globs, a decisions log, a
 * package file. They are the right size for finding something and the wrong size for
 * reading it, and scrolling a 300px box is how people stop reading and start skimming.
 *
 * So anything dense gets an icon in its corner that opens the same content at the size of
 * the screen. The content is rendered in one place at a time — moved, not copied — so a
 * file that was open on its source tab is still on its source tab inside the dialog, and
 * closing it does not reset anything.
 */
export function Expand({
  title,
  note,
  children,
  /** A wider dialog for things read across, like a table or a diff. */
  wide,
}: {
  title: ReactNode;
  note?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const t = useTranslator();
  const [open, setOpen] = useState(false);
  const closer = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    closer.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open) {
    return (
      <div className="expand-host">
        <button
          type="button"
          className="expand-btn"
          onClick={() => setOpen(true)}
          title={t('expand.open')}
          aria-label={t('expand.open')}
        >
          <Icon name="external" />
        </button>
        {children}
      </div>
    );
  }

  const dialog = (
    <div
      className="overlay expand-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
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
            onClick={() => setOpen(false)}
            title={t('expand.close')}
            aria-label={t('expand.close')}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="expand-body">{children}</div>
      </div>
    </div>
  );

  return (
    <div className="expand-host">

      <div className="expand-away" aria-hidden="true">
        <span className="sm t3">{t('expand.moved')}</span>
      </div>

      {createPortal(dialog, document.body)}
    </div>
  );
}

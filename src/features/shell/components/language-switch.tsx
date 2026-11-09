'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { LOCALE_LABEL, LOCALES } from '@/shared/i18n/config';
import type { Locale } from '@/shared/i18n/config';
import { useLocale, useTranslator } from '@/shared/i18n/provider';
import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/icons';
import { setLocale } from '../actions';

/** The full name, for the menu; the short code stays on the button. */
const LOCALE_NAME: Record<Locale, string> = { en: 'English', tr: 'Türkçe' };

/**
 * The language menu.
 *
 * It was a two-button segmented control, which spent the width of both languages to say
 * which one you are already reading. A menu says the current one and keeps the other
 * behind a click — and leaves room in the top bar for the things that change.
 */
export function LanguageSwitch() {
  const current = useLocale();
  const t = useTranslator();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="menu" ref={root}>
      <button
        type="button"
        className="menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('top.language')}
        aria-busy={pending}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="globe" />
        <span className="menu-value">{LOCALE_LABEL[current]}</span>
        <Icon name="chevronDown" className="menu-caret" />
      </button>

      {open ? (
        <div className="menu-pop" role="menu" aria-label={t('top.language')}>
          {LOCALES.map((locale: Locale) => (
            <button
              key={locale}
              type="button"
              role="menuitemradio"
              aria-checked={current === locale}
              className={cn('menu-item', current === locale && 'is-on')}
              onClick={() => {
                setOpen(false);
                if (locale !== current) start(() => void setLocale(locale));
              }}
            >
              <span className="menu-code mono">{LOCALE_LABEL[locale]}</span>
              <span className="grow">{LOCALE_NAME[locale]}</span>
              {current === locale ? <Icon name="check" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

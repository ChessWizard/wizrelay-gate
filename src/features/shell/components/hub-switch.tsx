'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslator } from '@/shared/i18n/provider';
import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/icons';
import { switchHub } from '@/features/admin/actions';

export function HubSwitch({
  hubs,
  activeId,
}: {
  hubs: { id: string; name: string }[];
  activeId: string | null;
}) {
  const t = useTranslator();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const active = hubs.find((hub) => hub.id === activeId);

  if (hubs.length === 0) {
    return (
      <span className="ws">
        <Icon name="hub" />
        <span className="trunc">{t('hub.none')}</span>
      </span>
    );
  }

  return (
    <div className="menu" ref={root}>
      <button
        type="button"
        className="ws"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-busy={pending}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="hub" />
        <span className="mono trunc">{active?.name ?? t('hub.switch')}</span>
        {hubs.length > 1 ? <Icon name="chevronDown" className="menu-caret" /> : null}
      </button>

      {open && hubs.length > 1 ? (
        <div className="menu-pop menu-pop-left" role="menu" aria-label={t('hub.switch')}>
          {hubs.map((hub) => (
            <button
              key={hub.id}
              type="button"
              role="menuitemradio"
              aria-checked={hub.id === activeId}
              className={cn('menu-item', hub.id === activeId && 'is-on')}
              onClick={() => {
                setOpen(false);
                start(async () => {
                  await switchHub(hub.id);
                  router.refresh();
                });
              }}
            >
              <Icon name="hub" />
              <span className="grow trunc">{hub.name}</span>
              {hub.id === activeId ? <Icon name="check" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

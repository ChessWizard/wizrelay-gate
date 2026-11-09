'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { GlobalRole } from '@/core/auth/roles';
import { actorTone, initials } from '@/core/identity/actor';
import { useTranslator } from '@/shared/i18n/provider';
import { Icon } from '@/shared/ui/icons';
import { SignOutButton } from '@/features/auth/components/sign-out-button';

export function UserMenu({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: GlobalRole;
}) {
  const t = useTranslator();
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

  return (
    <div className="menu" ref={root} data-tour="user">
      <button
        type="button"
        className="actor"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="av" data-tone={actorTone({ id: email })} aria-hidden="true">
          {initials({ name, email })}
        </span>
        <span className="an trunc">{name}</span>
      </button>

      {open ? (
        <div className="menu-pop" role="menu">
          <div className="menu-head">
            <span className="strong trunc">{name}</span>
            <span className="xs t3 trunc mono">{email}</span>
            <span className="chip s-idle">{t(`role.${role}` as 'role.ADMIN')}</span>
          </div>
          <Link className="menu-item" href="/connections" role="menuitem" onClick={() => setOpen(false)}>
            <Icon name="branch" />
            <span className="grow">{t('connections.title')}</span>
          </Link>
          <Link className="menu-item" href="/settings" role="menuitem" onClick={() => setOpen(false)}>
            <Icon name="settings" />
            <span className="grow">{t('nav.settings')}</span>
          </Link>
          <div className="menu-foot">
            <SignOutButton size="sm" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

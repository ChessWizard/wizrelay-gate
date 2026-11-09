'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { GlobalRole } from '@/core/auth/roles';
import { useTransition } from 'react';
import type { Branding } from '@/services/panel/branding';
import type { Rail } from '@/services/panel/rail';
import { useTranslator } from '@/shared/i18n/provider';
import { cn } from '@/shared/lib/cn';
import { Icon, Mark } from '@/shared/ui/icons';
import type { IconName } from '@/shared/ui/icons';
import { toggleRail } from '../actions';

interface Item {
  href: string;
  icon: IconName;
  labelKey:
    | 'nav.board'
    | 'nav.relays'
    | 'nav.questions'
    | 'nav.people'
    | 'nav.activity'
    | 'nav.inbox'
    | 'nav.admin'
    | 'nav.settings';
  count?: number;
  adminOnly?: boolean;
}

export function Nav({
  brand,
  role,
  needsYou,
  openQuestions,
  inbox,
  rail,
}: {
  brand: Branding;
  role: GlobalRole;
  needsYou: number;
  openQuestions: number;
  inbox: number;
  rail: Rail;
}) {
  const pathname = usePathname();
  const t = useTranslator();
  const [pending, start] = useTransition();

  const items: Item[] = [
    { href: '/', icon: 'board', labelKey: 'nav.board', count: needsYou || undefined },
    { href: '/relays', icon: 'relay', labelKey: 'nav.relays' },
    { href: '/inbox', icon: 'bell', labelKey: 'nav.inbox', count: inbox || undefined },
    { href: '/questions', icon: 'questions', labelKey: 'nav.questions', count: openQuestions || undefined },
    { href: '/people', icon: 'people', labelKey: 'nav.people' },
    { href: '/activity', icon: 'pulse', labelKey: 'nav.activity' },
    { href: '/admin', icon: 'shield', labelKey: 'nav.admin', adminOnly: true },
  ];

  const isOn = (href: string) =>
    href === '/' ? pathname === '/' || pathname.startsWith('/relay') : pathname.startsWith(href);

  return (
    <nav className="nav" aria-label={t('nav.main')} data-tour="nav">
      <Link href="/" className="mark" aria-label={brand.name}>
        {brand.logoUrl ? (

          <img src={brand.logoUrl} alt="" className="nav-logo" />
        ) : (
          <Mark />
        )}
        <span className="wm trunc">{brand.name}</span>
      </Link>

      {items
        .filter((item) => !item.adminOnly || role !== 'MEMBER')
        .map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(isOn(item.href) && 'is-on')}
            aria-current={isOn(item.href) ? 'page' : undefined}
          >
            <Icon name={item.icon} size={20} />
            <span>{t(item.labelKey)}</span>
            {item.count ? <span className="count">{item.count}</span> : null}
          </Link>
        ))}

      <span className="spacer" />

      <Link
        href="/settings"
        className={cn(isOn('/settings') && 'is-on')}
        aria-current={isOn('/settings') ? 'page' : undefined}
      >
        <Icon name="settings" size={20} />
        <span>{t('nav.settings')}</span>
      </Link>

      <button
        type="button"
        className="rail-toggle"
        aria-pressed={rail === 'closed'}
        aria-label={rail === 'open' ? t('nav.collapse') : t('nav.expand')}
        title={rail === 'open' ? t('nav.collapse') : t('nav.expand')}
        disabled={pending}
        onClick={() => start(() => void toggleRail(rail === 'open' ? 'closed' : 'open'))}
      >
        <Icon name="sidebar" size={16} />
      </button>
    </nav>
  );
}

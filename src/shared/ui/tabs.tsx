'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { Icon } from './icons';
import type { IconName } from './icons';

export interface TabDef {
  id: string;
  label: string;
  icon?: IconName;
  count?: number;
}

/**
 * Sections of one page, rather than pages of one section.
 *
 * Administration is one screen with three unrelated halves — what the panel is, which
 * hubs it reads, who may sign in — and scrolling past two of them to reach the third was
 * the whole experience of using it. These are tabs because it is still one page: the
 * state is in the URL, so a tab is a link, the back button works and a reload lands where
 * it left off, but nothing navigates and nothing is fetched twice.
 */
export function Tabs({
  tabs,
  active,
  param = 'tab',
  children,
}: {
  tabs: TabDef[];
  active: string;
  param?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const go = (id: string) => {
    const next = new URLSearchParams(params.toString());
    if (id === tabs[0].id) next.delete(param);
    else next.set(param, id);
    const query = next.toString();
    router.replace(`?${query}`, { scroll: false });
  };

  return (
    <>
      <div className="tabs" role="tablist">
        {tabs.map((tab) => {
          const on = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={cn('tab', on && 'is-on')}
              onClick={() => go(tab.id)}
            >
              {tab.icon ? <Icon name={tab.icon} /> : null}
              <span>{tab.label}</span>
              {tab.count !== undefined ? <span className="tab-n">{tab.count}</span> : null}
            </button>
          );
        })}
      </div>
      <div className="tab-body" role="tabpanel">
        {children}
      </div>
    </>
  );
}

/** One tab's contents, rendered on the server and hidden rather than refetched. */
export function TabPane({ when, active, children }: { when: string; active: string; children: ReactNode }) {
  if (when !== active) return null;
  return <>{children}</>;
}

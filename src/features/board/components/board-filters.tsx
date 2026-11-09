'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { hasTerm, toggleTerm } from '@/core/search/query';
import { useTranslator } from '@/shared/i18n/provider';
import { FilterButton, Segmented } from '@/shared/ui/controls';
import { Icon } from '@/shared/ui/icons';

/**
 * The board's filters, as terms in the search query.
 *
 * A chip here writes `needs:me` or `status:failed` into the same `?q=` the search box
 * types into, so there is one place state lives, the filter and the box can never disagree,
 * and a filtered board is a link someone can send. The earlier version of this row had
 * five chips that were decoration — they are now either real or gone.
 */
export function BoardFilters({
  count,
  roles,
  pipeline,
  table,
}: {
  count: number;
  roles: string[];
  pipeline: ReactNode;
  table: ReactNode;
}) {
  const t = useTranslator();
  const router = useRouter();
  const params = useSearchParams();
  const [view, setView] = useState<'pipeline' | 'table'>('pipeline');

  const raw = params.get('q') ?? '';

  const toggle = (key: 'needs' | 'status' | 'role', value: string) => {
    const next = new URLSearchParams(params.toString());
    const query = toggleTerm(raw, key, value);
    if (query.trim()) next.set('q', query);
    else next.delete('q');
    const search = next.toString();
    router.replace(`/${search ? `?${search}` : ''}`, { scroll: false });
  };

  return (
    <section className="stack" style={{ gap: 'var(--space-3)' }}>
      <div className="row wrap spread" style={{ gap: 'var(--space-3)' }}>
        <div className="row wrap" style={{ gap: '6px' }}>
          <FilterButton
            icon="waiting"
            active={hasTerm(raw, 'needs', 'me')}
            onClick={() => toggle('needs', 'me')}
          >
            {t('board.filter.needsMe')}
          </FilterButton>
          <FilterButton
            icon="failed"
            active={hasTerm(raw, 'status', 'failed')}
            onClick={() => toggle('status', 'failed')}
          >
            {t('board.filter.failed')}
          </FilterButton>
          <FilterButton
            icon="running"
            active={hasTerm(raw, 'status', 'running')}
            onClick={() => toggle('status', 'running')}
          >
            {t('board.filter.running')}
          </FilterButton>
          {roles.map((role) => (
            <FilterButton
              key={role}
              active={hasTerm(raw, 'role', role)}
              onClick={() => toggle('role', role)}
            >
              <span className="mono">{role}</span>
            </FilterButton>
          ))}
        </div>

        <div className="row" style={{ gap: '8px' }}>
          <span className="count-badge">{count}</span>
          <Segmented
            label={t('board.view')}
            active={view}
            onSelect={(id) => setView(id as 'pipeline' | 'table')}
            options={[
              { id: 'pipeline', label: <Icon name="pulse" label={t('board.view.pipeline')} /> },
              { id: 'table', label: <Icon name="board" label={t('board.view.table')} /> },
            ]}
          />
        </div>
      </div>
      {view === 'pipeline' ? pipeline : table}
    </section>
  );
}

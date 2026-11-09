'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { GATE_IDS } from '@/core/gates/gates';
import { hasTerm, toggleTerm } from '@/core/search/query';
import { useTranslator } from '@/shared/i18n/provider';
import { Button } from '@/shared/ui/primitives';
import { FilterButton } from '@/shared/ui/controls';

const STATUSES = ['running', 'waiting', 'failed', 'passed'] as const;

/**
 * The relay list's filters.
 *
 * Everything here writes into the same `?q=` the search box types into, so the box and
 * the chips can never disagree and a filtered list is a link somebody can send. The
 * search box used to filter the board in place, which meant a search had no page of its
 * own: no way to narrow it further, and no way to show somebody else what you found.
 */
export function RelayFilters({ roles, count, total }: { roles: string[]; count: number; total: number }) {
  const t = useTranslator();
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get('q') ?? '';

  const go = (query: string) => {
    const next = new URLSearchParams(params.toString());
    if (query.trim()) next.set('q', query);
    else next.delete('q');
    const search = next.toString();
    router.replace(`/relays${search ? `?${search}` : ''}`, { scroll: false });
  };

  const toggle = (key: 'needs' | 'status' | 'role' | 'gate', value: string) =>
    go(toggleTerm(raw, key, value));

  return (
    <section className="relay-filters">
      <div className="relay-filter-row">
        <span className="label">{t('relays.filters')}</span>
        <div className="row wrap" style={{ gap: '6px' }}>
          <FilterButton
            icon="waiting"
            active={hasTerm(raw, 'needs', 'me')}
            onClick={() => toggle('needs', 'me')}
          >
            {t('board.filter.needsMe')}
          </FilterButton>
          {STATUSES.map((status) => (
            <FilterButton
              key={status}
              icon={status}
              active={hasTerm(raw, 'status', status)}
              onClick={() => toggle('status', status)}
            >
              {t(`status.${status}` as 'status.running')}
            </FilterButton>
          ))}
        </div>
      </div>

      {roles.length > 0 ? (
        <div className="relay-filter-row">
          <span className="label">{t('board.column.role')}</span>
          <div className="row wrap" style={{ gap: '6px' }}>
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
        </div>
      ) : null}

      <div className="relay-filter-row">
        <span className="label">{t('board.column.gate')}</span>
        <div className="row wrap" style={{ gap: '6px' }}>
          {GATE_IDS.map((gate) => (
            <FilterButton
              key={gate}
              active={hasTerm(raw, 'gate', gate)}
              onClick={() => toggle('gate', gate)}
            >
              {t(`gate.${gate}` as 'gate.research')}
            </FilterButton>
          ))}
        </div>
      </div>

      <div className="row wrap spread" style={{ gap: '8px' }}>
        <span className="xs t3">
          {count === total ? `${total}` : t('relays.matching', { count: String(count) })}
        </span>
        {raw ? (
          <Button size="sm" variant="ghost" icon="close" onClick={() => go('')}>
            {t('relays.clear')}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

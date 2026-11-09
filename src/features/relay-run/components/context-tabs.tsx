'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { Tabs } from '@/shared/ui/controls';

/**
 * The run's context, one panel at a time.
 *
 * Scope, routing, questions and the launch command were four open panels stacked down the
 * side of the screen. All four are needed at some point and none of them every minute, so
 * they are tabs now: the same information, a quarter of the page.
 */
export function ContextTabs({
  scope,
  routing,
  questions,
  launch,
  counts,
}: {
  scope: ReactNode;
  routing?: ReactNode;
  questions: ReactNode;
  launch?: ReactNode;
  counts: { questions: number };
}) {
  const t = useTranslator();
  const [tab, setTab] = useState('scope');

  const tabs = [
    { id: 'scope', label: t('run.context.scope') },
    ...(routing ? [{ id: 'routing', label: t('run.context.routing') }] : []),
    { id: 'questions', label: t('run.context.questions'), count: counts.questions || '' },
    ...(launch ? [{ id: 'launch', label: t('run.launchTab') }] : []),
  ];

  return (
    <section className="panel" aria-label={t('run.context.progress')}>
      <Tabs label={t('run.context.progress')} active={tab} onSelect={setTab} tabs={tabs} />
      <div className="panel-b">
        {tab === 'scope' ? scope : null}
        {tab === 'routing' ? routing : null}
        {tab === 'questions' ? questions : null}
        {tab === 'launch' ? launch : null}
      </div>
    </section>
  );
}

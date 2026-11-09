'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { Tabs } from '@/shared/ui/controls';

/**
 * The gate's detail pane. Checks first, always: the deterministic answer is the point,
 * and the console is one tab away rather than the default.
 */
export function GatePane({
  header,
  strip,
  prompt,
  steps,
  checks,
  console: consoleTab,
  artifacts,
  metrics,
  counts,
}: {
  header: ReactNode;
  strip?: ReactNode;
  prompt?: ReactNode;
  steps: ReactNode;
  checks: ReactNode;
  console: ReactNode;
  artifacts: ReactNode;
  metrics: ReactNode;
  counts: { checks: number; artifacts: number; steps: number };
}) {
  const t = useTranslator();

  const [tab, setTab] = useState('steps');

  return (
    <section className="run-pane panel" aria-label={t('run.tab.checks')}>
      {header}
      {strip}
      {prompt}
      <div className="tabs" style={{ marginTop: '8px' }}>
        <Tabs
          label={t('run.tab.checks')}
          active={tab}
          onSelect={setTab}
          tabs={[
            { id: 'steps', label: t('steps.title'), count: counts.steps || '' },
            { id: 'checks', label: t('run.tab.checks'), count: counts.checks || '' },
            { id: 'console', label: t('run.tab.console') },
            { id: 'artifacts', label: t('run.tab.artifacts'), count: counts.artifacts || '' },
            { id: 'metrics', label: t('run.tab.metrics') },
          ]}
        />
      </div>
      {tab === 'steps' ? steps : null}
      {tab === 'checks' ? checks : null}
      {tab === 'console' ? consoleTab : null}
      {tab === 'artifacts' ? artifacts : null}
      {tab === 'metrics' ? metrics : null}
    </section>
  );
}

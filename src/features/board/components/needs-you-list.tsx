import Link from 'next/link';
import type { NeedsYouItem } from '@/core/relay/types';
import { relativeTime } from '@/core/time/format';
import type { Locale } from '@/shared/i18n/config';
import type { Translator } from '@/shared/i18n/translate';
import { Icon } from '@/shared/ui/icons';
import { SectionHeader } from '@/shared/ui/primitives';

const ACTION_KEY = {
  decision: 'prompt.answer',
  input: 'prompt.answer',
  approval: 'common.open',
  scope: 'prompt.answer',
  attachment: 'prompt.browse',
} as const;

/**
 * The first thing on the board, and the reason the app was opened: every open prompt,
 * oldest first, each one a sentence and a way in.
 */
export function NeedsYouList({
  items,
  t,
  locale,
}: {
  items: NeedsYouItem[];
  t: Translator;
  locale: Locale;
}) {
  if (items.length === 0) return null;

  return (
    <section id="needs" data-tour="needs" className="stack anchor" style={{ gap: '10px' }}>
      <SectionHeader
        title={t('top.needsYou')}
        count={items.length}
        note={t('board.needsSub')}
        spread={false}
      />
      <div className="needs-list">
        {items.map((item) => {
          const href = `/relay/${item.relayId}/gate/${item.gate}/console${
            item.role ? `?role=${item.role}` : ''
          }#pinned`;
          return (
            <div className="needs-card" key={`${item.relayId}-${item.prompt.id}`}>
              <span className="chip s-waiting" style={{ flex: 'none' }}>
                <Icon name="waiting" />
                {t(`gate.${item.gate}` as 'gate.pull')}
              </span>
              <div className="grow stack" style={{ gap: '4px' }}>
                <div className="row wrap" style={{ gap: '6px' }}>
                  <span className="mono xs t2">{item.relayId}</span>
                  <span className="xs t3">
                    · {item.role ?? t('top.persona.hub')} ·{' '}
                    {t('common.ago', { age: relativeTime(item.prompt.askedAt, locale) })}
                  </span>
                  {item.prompt.payload?.step ? (
                    <span className="xs t3">
                      ·{' '}
                      {t('prompt.step', {
                        index: item.prompt.payload.step.index,
                        total: item.prompt.payload.step.total,
                      })}
                    </span>
                  ) : null}
                </div>
                <span className="q">{item.prompt.question}</span>
              </div>
              <Link className="btn btn-primary btn-sm" href={href} style={{ flex: 'none' }}>
                {t(ACTION_KEY[item.prompt.variant])}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

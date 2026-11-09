import Link from 'next/link';
import type { Decision, Question } from '@/core/relay/types';
import { absoluteTime, relativeTime } from '@/core/time/format';
import type { Locale } from '@/shared/i18n/config';
import type { Translator } from '@/shared/i18n/translate';
import { Icon, type IconName } from '@/shared/ui/icons';
import { cn } from '@/shared/lib/cn';

type StopState = 'done' | 'live' | 'idle' | 'skipped';

interface Stop {
  id: string;
  name: string;
  note: string;
  state: StopState;
}

const STOP_ICON: Record<StopState, IconName> = {
  done: 'passed',
  live: 'waiting',
  idle: 'idle',
  skipped: 'skipped',
};

/**
 * The question loop: the six stops a question passes before it comes back as a decision.
 *
 * It used to be one row of monospace fragments separated by arrows — `/wizrelay:ask → Q-1
 * OPEN · questions.md → …` — which read as a command log rather than as progress, and said
 * nothing about where the question actually was. Each stop now carries its own state, its
 * own sentence, and the only honest metric in the loop: how long the developer has been
 * waiting. Nothing here is a guess; every state comes from the package on disk.
 */
export function QuestionLoop({
  question,
  decision,
  relayVersion,
  hubVersion,
  href,
  t,
  locale,
}: {
  question: Question;
  /** The decision this question points at, when `decisions.md` already holds it. */
  decision?: Decision;
  relayVersion: number;
  /** The version published in the hub, when it is ahead of the working copy. */
  hubVersion?: number;
  href: string;
  t: Translator;
  locale: Locale;
}) {
  const answered = question.status === 'ANSWERED';
  const age = relativeTime(question.askedAt, locale);
  const published = decision !== undefined && decision.version <= (hubVersion ?? relayVersion);
  const behind = hubVersion !== undefined && hubVersion > relayVersion;

  const stops: Stop[] = [
    {
      id: 'asked',
      name: t('qloop.asked'),
      note: t('qloop.askedNote'),
      state: 'done',
    },
    {
      id: 'recorded',
      name: t('qloop.recorded'),
      note: t('qloop.recordedNote'),
      state: 'done',
    },
    {
      id: 'tracker',
      name: t('qloop.tracker'),
      note: question.trackerComment ?? t('qloop.trackerNone'),
      state: question.trackerComment ? 'done' : 'skipped',
    },
    {
      id: 'answer',
      name: t('qloop.answer'),
      note: answered ? t('qloop.answerDone') : t('qloop.answerWaiting', { age }),
      state: answered ? 'done' : 'live',
    },
    {
      id: 'decision',
      name: t('qloop.decision'),
      note: decision ? `${decision.id} · ${decision.title}` : t('qloop.decisionNone'),
      state: decision ? 'done' : answered ? 'live' : 'idle',
    },
    {
      id: 'publish',
      name: t('qloop.publish'),
      note: published
        ? t('qloop.publishDone', { version: decision?.version ?? relayVersion })
        : t('qloop.publishWaiting'),
      state: published ? 'done' : 'idle',
    },
    {
      id: 'sync',
      name: t('qloop.sync'),
      note: behind ? t('qloop.syncWaiting') : t('qloop.syncDone'),
      state: published && !behind ? 'done' : published ? 'live' : 'idle',
    },
  ];

  return (
    <section className="qloop" aria-label={t('lane.handoff')}>
      <header className="qloop-head">
        <div className="qloop-id">
          <span className={cn('qloop-mark', answered ? 's-passed' : 's-handoff')}>
            <Icon name={answered ? 'passed' : 'handoff'} />
          </span>
          <div className="qloop-naming">
            <span className="qloop-title">{t('lane.handoff')}</span>
            <span className="qloop-meta">
              <span className="mono">{question.id}</span>
              <span className="t3" title={absoluteTime(question.askedAt, locale)}>
                {t('questions.age', { age })}
              </span>
              {question.blocks ? (
                <span className="t3">{t('questions.blocks', { criterion: question.blocks })}</span>
              ) : null}
            </span>
          </div>
        </div>
        <Link className="qloop-open sm" href={href}>
          {t('qloop.open')}
          <Icon name="chevron" />
        </Link>
      </header>

      <p className="qloop-q">{question.title}</p>
      <p className="qloop-lead xs t3">{t('qloop.lead')}</p>

      <ol className="qloop-stops">
        {stops.map((stop, index) => (
          <li key={stop.id} className={cn('qstop', `is-${stop.state}`)}>
            <span className="qstop-dot">
              <Icon name={STOP_ICON[stop.state]} />
            </span>
            <span className="qstop-n">{index + 1}</span>
            <span className="qstop-name">{stop.name}</span>
            <span className="qstop-note">{stop.note}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

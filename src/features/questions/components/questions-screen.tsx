import Link from 'next/link';
import { absoluteTime, relativeTime } from '@/core/time/format';
import type { Decision } from '@/core/relay/types';
import { readPackage } from '@/services/packages/files';
import type { AskedQuestion } from '@/services/relays/service';
import { loadQuestions } from '@/services/relays/service';
import { getWorkspace } from '@/services/store/store';
import { currentSession } from '@/services/auth/session';
import { prisma } from '@/services/db/client';
import { handleFor } from '@/core/packages/mentions';
import { createTranslator } from '@/shared/i18n/translate';
import type { Locale } from '@/shared/i18n/config';
import type { Translator } from '@/shared/i18n/translate';
import { Icon } from '@/shared/ui/icons';
import { Empty, LinkButton, Panel, Row, SectionHeader, Stack } from '@/shared/ui/primitives';
import { MentionChip, WithMentions } from '@/shared/ui/mention';
import type { QuestionThread } from '@/services/questions/routing';
import { threadsFor } from '@/services/questions/routing';
import { hasClickUp } from '@/services/integrations/clickup';
import { AskOnTracker } from './ask-on-tracker';
import { PersonaSwitch } from './persona-switch';

function QuestionCard({
  item,
  names,
  decisions,
  thread,
  tracker,
  t,
  locale,
}: {
  item: AskedQuestion;
  /** Display names for the handles the panel recognises. */
  names: Map<string, string>;
  /** The relay's own `decisions.md`, so an answered question shows the real decision. */
  decisions: Decision[];
  /** What the task's card already says about this question. */
  thread: QuestionThread;
  /** A tracker is connected, so asking on the card is possible at all. */
  tracker: boolean;
  t: Translator;
  locale: Locale;
}) {
  const { relay, question, audience } = item;
  const decision = question.decisionId
    ? decisions.find((candidate) => candidate.id === question.decisionId)
    : undefined;

  return (
    <div className="card stack" style={{ gap: '8px' }}>
      <div className="row spread wrap" style={{ gap: '8px' }}>
        <Row gap={8} wrap>
          <span className="mono strong">{question.id}</span>
          <span
            className={`chip ${
              question.status === 'OPEN'
                ? 's-handoff'
                : question.status === 'ANSWERED'
                  ? 's-passed'
                  : 's-skipped'
            }`}
          >
            <Icon
              name={
                question.status === 'OPEN' ? 'handoff' : question.status === 'ANSWERED' ? 'passed' : 'skipped'
              }
            />
            {t(`questions.status.${question.status}` as 'questions.status.OPEN')}
          </span>
          {item.waitingOnYou && question.status === 'OPEN' ? (
            <span className="chip s-waiting">
              <Icon name="bell" />
              {t('questions.forYou')}
            </span>
          ) : null}
        </Row>
        <span className="xs t3" title={absoluteTime(question.askedAt, locale)}>
          {t('questions.age', { age: relativeTime(question.askedAt, locale) })}
        </span>
      </div>

      <span className="strong">
        <WithMentions text={question.title} />
      </span>
      {question.body ? (
        <span className="sm t2">
          <WithMentions text={question.body} />
        </span>
      ) : null}

      <div className="q-route">
        {audience.from ? (
          <>
            <MentionChip handle={audience.from} name={names.get(audience.from)} muted />
            <Icon name="chevron" />
          </>
        ) : null}
        {item.unrouted ? (
          <span className="chip s-warned">
            <Icon name="warned" />
            {t('questions.unrouted')}
          </span>
        ) : (
          audience.to.map((handle) => (
            <MentionChip key={handle} handle={handle} name={names.get(handle)} />
          ))
        )}
        {audience.inherited && !item.unrouted ? (
          <span className="xs t3">{t('questions.viaLead')}</span>
        ) : null}
      </div>

      <Row wrap gap={10}>
        <Link className="mono xs" href={`/relay/${relay.id}?role=${question.role ?? ''}`}>
          {relay.id}
        </Link>
        {question.role ? <span className="mono xs t3">{question.role}</span> : null}
        {question.blocks ? (
          <span className="xs t3">{t('questions.blocks', { criterion: question.blocks })}</span>
        ) : null}
      </Row>

      {question.trackerComment ? (
        <div className="payload">
          <div className="payload-h">
            <span>{t('questions.trackerComment')}</span>
          </div>
          <pre>{question.trackerComment}</pre>
        </div>
      ) : null}

      {thread.replies.length > 0 ? (
        <div className="q-replies">
          <span className="label">{t('questions.replies')}</span>
          {thread.replies.map((reply) => (
            <div className="q-reply" key={reply.id}>
              <Row gap={8} wrap>
                <span className="sm strong">{reply.user}</span>
                <span className="xs t3" title={absoluteTime(reply.at, locale)}>
                  {relativeTime(reply.at, locale)}
                </span>
              </Row>
              <span className="sm t2">
                <WithMentions text={reply.text} />
              </span>
            </div>
          ))}
          {question.status === 'OPEN' ? (
            <span className="xs t3">{t('questions.pullForAnswer')}</span>
          ) : null}
        </div>
      ) : null}

      {decision ? (
        <div className="inset stack" style={{ gap: '4px' }}>
          <Row gap={8}>
            <span className="mono strong">{decision.id}</span>
            <span className="vchip">v{decision.version}</span>
            <span className="xs t3">{decision.date}</span>
          </Row>
          <span className="sm strong">{decision.title}</span>
          {decision.decision ? <span className="sm">{decision.decision}</span> : null}
          {decision.rationale ? <span className="xs t3">{decision.rationale}</span> : null}
        </div>
      ) : (
        <div className="row wrap" style={{ gap: '10px', alignItems: 'flex-start' }}>
          <LinkButton href={`/relay/${relay.id}?gate=research`} size="sm" variant="primary">
            {t('questions.draftDecision')}
          </LinkButton>
          <LinkButton href={`/relay/${relay.id}?gate=publish`} size="sm">
            {t('questions.publishDecision')}
          </LinkButton>
          {tracker && question.status === 'OPEN' ? (
            <AskOnTracker relayId={relay.id} questionId={question.id} posted={thread.posted} />
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * The question loop, from the two sides somebody actually stands on.
 *
 * "Mine" is what you asked and are waiting on; the inbox is what is waiting on you. They
 * used to be the same list under two headings, which meant neither side could tell at a
 * glance whether anything needed them. A question you are not part of is not here at all.
 */
export async function QuestionsScreen({ side }: { side?: string }) {
  const workspace = await getWorkspace();
  const t = createTranslator(workspace.locale);
  const locale = workspace.locale;
  const [all, session] = await Promise.all([loadQuestions(), currentSession()]);
  const me = session ? handleFor(session.user) : '';

  const relayIds = [...new Set(all.map((item) => item.relay.id))];
  const decisionsByRelay = new Map<string, Decision[]>(
    await Promise.all(
      relayIds.map(async (relayId): Promise<[string, Decision[]]> => {
        const { decisions } = await readPackage(workspace, relayId);
        return [relayId, decisions];
      }),
    ),
  );

  const handles = [
    ...new Set(all.flatMap((item) => [...item.audience.to, item.audience.from ?? ''])),
  ].filter(Boolean);
  const known = handles.length
    ? await prisma.user.findMany({
        where: { email: { in: handles } },
        select: { email: true, name: true },
      })
    : [];
  const names = new Map(known.map((person) => [person.email.toLowerCase(), person.name]));

  const tracker = session ? await hasClickUp(session.user.id) : false;
  const threads = new Map<string, QuestionThread>();
  if (tracker && session) {
    const userId = session.user.id;
    const byRelay = new Map<string, string[]>();
    for (const item of all) {
      byRelay.set(item.relay.id, [...(byRelay.get(item.relay.id) ?? []), item.question.id]);
    }
    await Promise.all(
      [...byRelay].map(async ([id, questionIds]) => {
        const read = await threadsFor(userId, id, questionIds);
        for (const [questionId, thread] of read) threads.set(`${id}-${questionId}`, thread);
      }),
    );
  }

  const inbox = side === 'inbox';
  const mine = inbox
    ? all.filter((item) => item.waitingOnYou)
    : all.filter((item) => item.audience.from === me);
  const open = mine.filter((item) => item.question.status === 'OPEN');
  const answered = mine.filter((item) => item.question.status !== 'OPEN');
  const emptyLine = inbox ? t('questions.noneForYou') : t('questions.noneAsked');

  const cards = (items: AskedQuestion[]) =>
    items.map((item) => (
      <QuestionCard
        key={`${item.relay.id}-${item.question.id}`}
        item={item}
        names={names}
        decisions={decisionsByRelay.get(item.relay.id) ?? []}
        thread={
          threads.get(`${item.relay.id}-${item.question.id}`) ?? { posted: false, replies: [] }
        }
        tracker={tracker}
        t={t}
        locale={locale}
      />
    ));

  return (
    <div className="page">
      <SectionHeader
        level={1}
        title={t('questions.title')}
        count={open.length}
        note={inbox ? t('questions.inboxHelp') : t('questions.mineHelp')}
        actions={<PersonaSwitch active={inbox ? 'inbox' : 'mine'} />}
      />

      {mine.length === 0 ? (
        <Empty title={emptyLine} />
      ) : (
        <div
          className={
            open.length === 0 || answered.length === 0 ? 'q-cols is-one' : 'q-cols'
          }
        >
          <Panel
            title={inbox ? t('questions.waitingOnYou') : t('questions.inProgress')}
            aside={<span className="count-badge">{open.length}</span>}
          >
            <Stack gap={12}>
              {open.length === 0 ? <span className="sm t3">{emptyLine}</span> : null}
              {cards(open)}
            </Stack>
          </Panel>

          <Panel
            title={t('questions.answered')}
            aside={<span className="count-badge">{answered.length}</span>}
          >
            <Stack gap={12}>
              {answered.length === 0 ? <span className="sm t3">{t('common.none')}</span> : null}
              {cards(answered)}
            </Stack>
          </Panel>
        </div>
      )}
    </div>
  );
}

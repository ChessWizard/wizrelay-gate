import Link from 'next/link';
import { relativeTime, absoluteTime } from '@/core/time/format';
import { requireUser } from '@/services/auth/context';
import { activityActors, listActivity } from '@/services/panel/activity';
import { activeContext } from '@/services/panel/active';
import { getLocale } from '@/services/panel/locale';
import { createTranslator } from '@/shared/i18n/translate';
import { Icon } from '@/shared/ui/icons';
import { Empty, LinkButton, Panel, Row, SectionHeader, Stack } from '@/shared/ui/primitives';
import { ActorAvatar } from '@/features/shell/components/actor-badge';
import { ActorFilter } from './actor-filter';

const ICON: Record<string, 'play' | 'questions' | 'package' | 'people' | 'commit' | 'shield' | 'trash'> = {
  GATE_RUN: 'play',
  PROMPT_ANSWERED: 'questions',
  QUESTION_ASKED: 'questions',
  QUESTION_ANSWERED: 'questions',
  PACKAGE_PUBLISHED: 'package',
  MEMBER_ADDED: 'people',
  MEMBER_ROLE_CHANGED: 'people',
  MEMBER_REMOVED: 'trash',
  PROJECT_ADDED: 'commit',
  PROJECT_REMOVED: 'trash',
  HUB_ADDED: 'commit',
  HUB_REMOVED: 'trash',
  SIGNED_IN: 'shield',
};

/** A removal reads differently from an addition, so it is not drawn the same. */
const REMOVALS = new Set(['MEMBER_REMOVED', 'PROJECT_REMOVED', 'HUB_REMOVED']);

/**
 * What people did to tasks, newest first.
 *
 * Paged by cursor, because the log is written to while it is being read: a gate finishing
 * shifts every row down, and an offset would skip whatever arrived in between. The link
 * at the foot carries the position, so going back a page is the back button.
 */
export async function ActivityScreen({ who, before }: { who?: string; before?: string }) {
  const { viewer } = await requireUser();
  const locale = await getLocale();
  const t = createTranslator(locale);

  const [page, context, actors] = await Promise.all([
    listActivity(viewer, { userId: who ?? null, before: before ?? null }),
    activeContext(),
    activityActors(viewer),
  ]);

  const query = (cursor: string) =>
    `/activity?${new URLSearchParams({ ...(who ? { who } : {}), before: cursor }).toString()}`;

  return (
    <div className="page">
      <SectionHeader
        level={1}
        title={t('activity.title')}
        note={context.hub?.name ?? undefined}
      />

      <ActorFilter actors={actors} active={who ?? null} />

      {page.entries.length === 0 ? (
        <Empty
          title={before ? t('activity.noMore') : t('activity.noRecent')}
          body={before ? undefined : t('activity.noRecentHow')}
          action={before ? <LinkButton href="/activity">{t('activity.backToTop')}</LinkButton> : undefined}
        />
      ) : (
        <Panel>
          <Stack gap={0}>
            <div className="checks">
              {page.entries.map((entry) => (
                <div className="check" key={entry.id}>
                  <span className={REMOVALS.has(entry.kind) ? 'ci s-warned' : 'ci s-idle'}>
                    <Icon name={ICON[entry.kind] ?? 'dot'} />
                  </span>
                  <Stack gap={2}>
                    <Row wrap gap={8}>
                      {entry.actorName ? (
                        <>
                          <ActorAvatar
                            actor={{
                              id: entry.actorEmail ?? entry.actorName,
                              name: entry.actorName,
                              source: 'claude',
                            }}
                            size="sm"
                          />
                          <span className="sm strong">{entry.actorName}</span>
                        </>
                      ) : (
                        <span className="sm t3" title={t('activity.noActorWhy')}>
                          {t('activity.noActor')}
                        </span>
                      )}
                      <span className="sm t2">
                        {t(`activity.kind.${entry.kind}` as 'activity.kind.GATE_RUN')}
                      </span>

                      {entry.gate ? (
                        <span className="chip s-idle">
                          {t(`gate.${entry.gate}` as 'gate.research')}
                        </span>
                      ) : null}

                      {entry.summary && entry.summary !== entry.actorName ? (
                        <span className="sm trunc">{entry.summary}</span>
                      ) : null}
                    </Row>
                    <Row wrap gap={8}>
                      {entry.relayId ? (
                        <Link className="mono xs" href={`/relay/${entry.relayId}`}>
                          {entry.relayId}
                        </Link>
                      ) : null}
                      {entry.projectRole ? <span className="mono xs t3">{entry.projectRole}</span> : null}
                      {entry.hubName ? <span className="xs t3">{entry.hubName}</span> : null}
                    </Row>
                  </Stack>
                  <span
                    className="xs t3 num"
                    title={absoluteTime(entry.at.toISOString(), locale)}
                  >
                    {relativeTime(entry.at.toISOString(), locale)}
                  </span>
                </div>
              ))}
            </div>

            {page.nextCursor || before ? (
              <Row wrap gap={10} className="activity-more">
                {before ? (
                  <LinkButton href={who ? `/activity?who=${who}` : '/activity'} size="sm">
                    {t('activity.backToTop')}
                  </LinkButton>
                ) : null}
                <span className="grow" />
                {page.nextCursor ? (
                  <LinkButton href={query(page.nextCursor)} size="sm" icon="chevronDown">
                    {t('activity.older')}
                  </LinkButton>
                ) : (
                  <span className="xs t3">{t('activity.noMore')}</span>
                )}
              </Row>
            ) : null}
          </Stack>
        </Panel>
      )}
    </div>
  );
}

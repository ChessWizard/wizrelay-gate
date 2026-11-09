import Link from 'next/link';
import { isEmptyQuery, parseQuery, search } from '@/core/search/query';
import { hasWorkInFlight } from '@/core/relay/derive';
import { formatDuration, relativeTime } from '@/core/time/format';
import { loadBoard } from '@/services/relays/service';
import { cliAvailable } from '@/services/cli/wizrelay';
import { createTranslator } from '@/shared/i18n/translate';
import { Banner, Empty, LinkButton, SectionHeader } from '@/shared/ui/primitives';
import { MetricTile, Table, TableBox } from '@/shared/ui/data';
import { Hint } from '@/shared/ui/hint';
import { StatusChip } from '@/shared/ui/status';
import { shortRepo } from '@/shared/ui/track-badges';
import { LiveRefresh } from '@/features/pipeline/components/live-refresh';
import { TodoList } from '@/features/guide/components/todo-list';
import { ProductTour } from '@/features/guide/components/product-tour';
import { HubBanner } from './hub-banner';
import { NeedsYouList } from './needs-you-list';
import { BoardFilters } from './board-filters';
import { RelayCard } from './relay-card';

function PipelineIllustration() {
  return (
    <svg
      className="ill"
      width="320"
      height="64"
      viewBox="0 0 320 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="2" y="20" width="60" height="24" rx="4" />
      <rect x="88" y="20" width="60" height="24" rx="4" />
      <rect x="174" y="20" width="60" height="24" rx="4" />
      <rect x="258" y="20" width="60" height="24" rx="4" strokeDasharray="4 4" />
      <path d="M62 32h26M148 32h26M234 32h24" />
    </svg>
  );
}

/**
 * S2 — the relay board.
 *
 * Three numbers, then what is waiting on someone, then the relays. The numbers that are
 * useful weekly rather than hourly — the verdict split, the scope violations, the median
 * wait — sit in one strip under the tiles instead of as tiles of their own: still there,
 * no longer competing with the thing the board is for.
 */
export async function BoardScreen({ q = '' }: { q?: string }) {
  const board = await loadBoard();
  const t = createTranslator(board.workspace.locale);
  const locale = board.workspace.locale;
  const hasCli = await cliAvailable();

  const { metrics, relays, needs, workspace, hub } = board;
  const verdictTotal = metrics.verdicts.pass + metrics.verdicts.partial + metrics.verdicts.fail;

  const query = parseQuery(q);
  const filtered = search(relays, query);
  const filtering = !isEmptyQuery(query);

  const roles = [...new Set(relays.flatMap((relay) => relay.roles))].sort();

  const live = relays.some((relay) =>
    hasWorkInFlight(
      [...relay.research, ...relay.byRole.flatMap((role) => role.gates)],
      relay.updatedAt,
    ),
  );

  const rows = filtered.flatMap((relay) =>
    relay.byRole.map((role) => {
      const active =
        role.gates.find((gate) => gate.status === 'waiting') ??
        role.gates.find((gate) => gate.status === 'failed') ??
        role.gates.find((gate) => gate.status === 'running' || gate.status === 'handoff') ??
        role.gates[role.gates.length - 1];
      const verify = role.gates.find((gate) => gate.gate === 'verify');
      return { relay, role, active, verify };
    }),
  );

  return (
    <div className="page">
      {!hasCli ? (
        <Banner tone="warn" title={t('banner.cliMissing')} body={t('banner.cliMissingHow')} />
      ) : null}
      {hub.connected && (hub.error || !hub.path) ? (
        <HubBanner tone="warn" title={t('banner.hubUnread')} body={hub.error} />
      ) : null}
      {hub.connected && hub.path && !hub.error && hub.packages === 0 ? (
        <HubBanner
          tone="info"
          title={t('banner.hubEmpty')}
          body={t('banner.hubFetched', { path: hub.path })}
        />
      ) : null}

      <SectionHeader
        level={1}
        title={t('board.title')}
        note={
          workspace.hub ? (
            <span className="row" style={{ gap: '8px' }}>
              <Link href="/settings">{workspace.hub.name ?? workspace.hub.url}</Link>
              <span className="t3">
                {t('board.fetched', {
                  time: hub.fetchedAt
                    ? relativeTime(hub.fetchedAt, locale)
                    : workspace.hub.lastFetch
                      ? relativeTime(workspace.hub.lastFetch, locale)
                      : t('common.none'),
                })}
              </span>
              <LiveRefresh live={live} />
              <ProductTour auto={relays.length > 0} />
            </span>
          ) : undefined
        }
        actions={
          <LinkButton href="/relays/new" variant="primary" icon="plus">
            {t('board.newRelay')}
          </LinkButton>
        }
      />

      {relays.length === 0 ? (
        <Empty
          title={workspace.mode === 'live' ? t('board.emptyLive') : t('board.empty')}
          body={t('board.emptyHow')}
          illustration={<PipelineIllustration />}
          action={
            <LinkButton href="/relays/new" variant="primary">
              {t('board.newRelay')}
            </LinkButton>
          }
        />
      ) : (
        <div className="stack" style={{ gap: 'var(--gap-section)' }}>
          <section className="tiles tiles-3" aria-label={t('board.metrics')}>
            <MetricTile
              label={
                <span className="row" style={{ gap: '6px' }}>
                  {t('metric.needsYou')}
                  <Hint title={t('metric.needsYou')}>{t('hint.needsYou')}</Hint>
                </span>
              }
              value={String(metrics.needsYou)}
              loud={metrics.needsYou > 0}
              sub={
                needs[0]
                  ? t('metric.oldest', { age: relativeTime(needs[0].prompt.askedAt, locale) })
                  : t('metric.none')
              }
            />
            <MetricTile
              label={t('metric.gatesFailed')}
              value={String(metrics.gatesFailed)}
              sub={metrics.gatesFailed > 0 ? t('board.filter.failed') : t('metric.none')}
            />
            <MetricTile
              label={t('metric.openQuestions')}
              value={String(metrics.openQuestions)}
              sub={
                metrics.oldestQuestionDays === null
                  ? t('metric.none')
                  : t('metric.oldest', {
                      age: formatDuration(metrics.oldestQuestionDays * 86_400_000, locale),
                    })
              }
            />
          </section>

          <div className="strip strip-plain">
            <span>
              <span className="k">{t('metric.verdicts')} </span>
              <Hint title={t('metric.verdicts')}>{t('hint.verdicts')}</Hint>{' '}
              <span className="v">
                {verdictTotal === 0
                  ? t('metric.none')
                  : `${metrics.verdicts.pass} / ${metrics.verdicts.partial} / ${metrics.verdicts.fail}`}
              </span>
            </span>
            <span>
              <span className="k">{t('metric.scopeViolations')} </span>
              <Hint title={t('metric.scopeViolations')}>{t('hint.scopeViolations')}</Hint>{' '}
              <span className="v">{metrics.scopeViolations}</span>
            </span>
            <span>
              <span className="k">{t('metric.medianWait')} </span>
              <Hint title={t('metric.medianWait')}>{t('hint.medianWait')}</Hint>{' '}
              <span className="v">
                {metrics.medianWaitMs === null
                  ? t('metric.none')
                  : formatDuration(metrics.medianWaitMs, locale)}
              </span>
            </span>
            <Link className="xs" href="/activity">
              {t('nav.activity')}
            </Link>
          </div>

          <TodoList compact />

          <NeedsYouList items={needs} t={t} locale={locale} />

          <BoardFilters
            count={filtered.length}
            roles={roles}
            pipeline={
              filtered.length === 0 ? (
                <Empty title={t('search.none', { query: query.raw })} body={t('search.noneHow')} />
              ) : (
                <div className="relays" data-tour="relays">
                  {filtered.map((relay) => (
                    <RelayCard key={relay.id} relay={relay} t={t} locale={locale} />
                  ))}
                </div>
              )
            }
            table={
              filtered.length === 0 ? (
                <Empty title={t('search.none', { query: query.raw })} body={t('search.noneHow')} />
              ) : (
                <TableBox>
                  <Table
                    label={t('board.relays')}
                    head={
                      <tr>
                        <th>{t('board.column.relay')}</th>
                        <th>{t('board.column.title')}</th>
                        <th className="mono">{t('board.column.role')}</th>
                        <th className="mono">{t('track.project')}</th>
                        <th>{t('board.column.stage')}</th>
                        <th>{t('board.column.status')}</th>
                        <th className="r">{t('board.column.age')}</th>
                        <th>{t('board.column.verdict')}</th>
                      </tr>
                    }
                  >
                    {rows.map(({ relay, role, active, verify }) => (
                      <tr key={`${relay.id}-${role.role}`}>
                        <td className="mono">
                          <Link href={`/relay/${relay.id}?role=${role.role}`}>{relay.id}</Link>
                        </td>
                        <td>{relay.title}</td>
                        <td className="mono">{role.role}</td>
                        <td className="mono trunc" title={role.repo}>
                          {role.repo ? shortRepo(role.repo) : t('common.none')}
                        </td>
                        <td>{active ? t(`gate.${active.gate}` as 'gate.pull') : t('common.none')}</td>
                        <td>
                          <StatusChip status={active?.status ?? 'idle'} t={t} />
                        </td>
                        <td className="r num" title={relay.updatedAt}>
                          {relativeTime(relay.updatedAt, locale)}
                        </td>
                        <td className="mono">{verify?.verdict ?? t('common.none')}</td>
                      </tr>
                    ))}
                  </Table>
                </TableBox>
              )
            }
          />
          {filtering ? <span className="sr">{t('search.results', { count: filtered.length })}</span> : null}
        </div>
      )}
    </div>
  );
}

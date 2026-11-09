import Link from 'next/link';
import { relayStatus } from '@/core/relay/derive';
import { relativeTime } from '@/core/time/format';
import { trackerLabel, trackerUrl } from '@/core/tracker/link';
import { summarise } from '@/core/relay/derive';
import { isEmptyQuery, parseQuery, search } from '@/core/search/query';
import { allRelays } from '@/services/relays/service';
import { getWorkspace } from '@/services/store/store';
import { createTranslator } from '@/shared/i18n/translate';
import { Empty, LinkButton, Panel, SectionHeader, VersionChip } from '@/shared/ui/primitives';
import { Table, TableBox } from '@/shared/ui/data';
import { Icon } from '@/shared/ui/icons';
import { Hint } from '@/shared/ui/hint';
import { StatusChip } from '@/shared/ui/status';
import { RelayFilters } from './relay-filters';

/**
 * The researcher's list: every package in the hub, draft or published.
 *
 * One row per package rather than per role, and the identifier lives under the title
 * instead of in a column of its own — a table of nine narrow columns was readable on
 * nothing. What is left is what a researcher scans for: what it is, how far it got, who
 * it is for, and the ticket it came from.
 */
export async function PackagesScreen({ query = '' }: { query?: string }) {
  const workspace = await getWorkspace();
  const t = createTranslator(workspace.locale);
  const all = await allRelays();

  const parsed = parseQuery(query);
  const keep = new Set(search(all.map(summarise), parsed).map((relay) => relay.id));
  const relays = isEmptyQuery(parsed) ? all : all.filter((relay) => keep.has(relay.id));
  const roles = [...new Set(all.flatMap((relay) => relay.roles))].sort();

  return (
    <div className="page">
      <SectionHeader
        level={1}
        title={t('relays.title')}
        count={relays.length}
        note={workspace.hub?.name ?? workspace.hub?.url ?? t('relays.subtitle')}
        actions={
          <LinkButton href="/relays/new" variant="primary" icon="plus">
            {t('board.newRelay')}
          </LinkButton>
        }
      />

      {all.length > 0 ? (
        <RelayFilters roles={roles} count={relays.length} total={all.length} />
      ) : null}

      {relays.length === 0 ? (
        <Empty
          title={all.length === 0 ? t('board.empty') : t('relays.noMatch')}
          body={all.length === 0 ? t('board.emptyHow') : undefined}
          action={
            all.length === 0 ? (
              <LinkButton href="/relays/new" variant="primary">
                {t('board.newRelay')}
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <Panel>
          <TableBox>
            <Table
              label={t('relays.title')}
              head={
                <tr>
                  <th>{t('board.column.title')}</th>
                  <th>
                    <span className="row" style={{ gap: '6px' }}>
                      {t('board.column.status')}
                      <Hint title={t('board.column.status')}>{t('hint.packageStatus')}</Hint>
                    </span>
                  </th>
                  <th className="num hide-md">
                    <span className="row" style={{ gap: '6px' }}>
                      {t('board.column.version')}
                      <Hint title={t('board.column.version')}>{t('hint.version')}</Hint>
                    </span>
                  </th>
                  <th>{t('board.column.role')}</th>
                  <th>{t('board.column.task')}</th>
                  <th className="r">{t('board.column.age')}</th>
                  <th className="r hide-sm" />
                </tr>
              }
            >
              {relays.map((relay) => {
                const status = relayStatus(relay);
                const href = trackerUrl(relay.tracker);
                const label = trackerLabel(relay.tracker);
                return (
                  <tr key={relay.id} className="tr-rich" data-status={status}>
                    <td>
                      <Link className="cell-title" href={`/relay/${relay.id}`}>
                        <span className="strong trunc">{relay.title}</span>
                        <span className="xs t3 mono">{relay.id}</span>
                      </Link>
                    </td>
                    <td>
                      <StatusChip status={status} t={t} />
                    </td>
                    <td className="num hide-md">
                      <VersionChip
                        ahead={relay.hubVersion !== undefined && relay.hubVersion > relay.version}
                      >
                        v{relay.version}
                      </VersionChip>
                    </td>
                    <td>
                      <span className="chips">
                        {relay.roles.map((role) => (
                          <span key={role} className="chip s-idle mono">
                            {role}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td>
                      {href ? (
                        <a className="tlink" href={href} target="_blank" rel="noreferrer noopener">
                          <span className="mono xs">{label || relay.tracker.type}</span>
                          <Icon name="external" size={16} />
                        </a>
                      ) : (
                        <span className="mono xs t3">{label || t('common.none')}</span>
                      )}
                    </td>
                    <td className="r num" title={relay.updatedAt}>
                      {relativeTime(relay.updatedAt, workspace.locale)}
                    </td>
                    <td className="r hide-sm">
                      <Link className="sm" href={`/package/${relay.id}`}>
                        {t('package.title')}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </Table>
          </TableBox>
        </Panel>
      )}
    </div>
  );
}

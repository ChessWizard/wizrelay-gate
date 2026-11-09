import { notFound } from 'next/navigation';
import { changedTotal, integrityClean } from '@/core/audit/types';
import type { AuditReport } from '@/core/audit/types';
import { findGateState } from '@/core/relay/derive';
import { absoluteTime, relativeTime } from '@/core/time/format';
import { audit as runAudit } from '@/services/cli/wizrelay';
import { loadRelay } from '@/services/relays/service';
import { getWorkspace } from '@/services/store/store';
import { createTranslator } from '@/shared/i18n/translate';
import { Icon } from '@/shared/ui/icons';
import {
  Banner,
  CommandBlock,
  GlobChip,
  Panel,
  Row,
  SectionHeader,
  Stack,
} from '@/shared/ui/primitives';
import { Timeline } from '@/shared/ui/data';

function PathList({ paths, empty }: { paths: string[]; empty: string }) {
  if (paths.length === 0) return <span className="sm t3">{empty}</span>;
  return (
    <Stack gap={2}>
      {paths.map((path) => (
        <span className="mono sm file" key={path}>
          {path}
        </span>
      ))}
    </Stack>
  );
}

/** S9 — scope and audit: four lists, the integrity check, and the guard timeline. */
export async function AuditScreen({ relayId, role }: { relayId: string; role?: string }) {
  const relay = await loadRelay(relayId);
  if (!relay) notFound();
  const workspace = await getWorkspace();
  const t = createTranslator(workspace.locale);
  const locale = workspace.locale;

  const activeRole = role && relay.roles.includes(role) ? role : relay.roles[0];
  const repo = workspace.repos.find((candidate) => candidate.role === activeRole);

  /**
   * An empty report, not a sample one.
   *
   * When the CLI cannot be run there is no audit, and showing someone else's clean report
   * in its place would be a lie about their repository. Every list is empty and `clean` is
   * false, so the screen reads as "not audited" rather than "nothing wrong".
   */
  let report: AuditReport = {
    schema_version: 1,
    task_id: relay.id,
    role: activeRole ?? null,
    enforcement: relay.enforcement,
    scope_defined: Boolean(activeRole && relay.scope[activeRole]),
    base: repo?.baseRef ?? null,
    base_available: false,
    in_scope: [],
    out_of_scope: [],
    forbidden: [],
    incidental: [],
    integrity: null,
    violations: 0,
    clean: false,
    notes: [],
  };
  let command = 'wizrelay audit --format json --no-fail';
  let live = false;

  if (workspace.mode === 'live' && repo) {
    const result = await runAudit(repo.path, { base: repo.baseRef });
    command = result.command;
    if (result.ok && result.data && !('skipped' in result.data)) {
      report = result.data;
      live = true;
    }
  }

  /**
   * Whether the audit actually looked at anything. `wizrelay audit` reports `clean: true`
   * when no task package is active, which is true and also not an all-clear — it checked
   * nothing. Its own notes say so, and the headline must not contradict them.
   */
  const checkedAnything =
    report.in_scope.length > 0 || report.out_of_scope.length > 0 || report.violations > 0;

  const implement = findGateState(relay, 'implement', activeRole)?.state;
  const guardEvents = implement?.guardEvents ?? [];
  const scope = activeRole ? relay.scope[activeRole] : undefined;

  return (
    <div className="page">
      <SectionHeader
        level={1}
        title={t('audit.title')}
        note={`${relay.id} · ${activeRole} · ${report.enforcement}`}
        actions={
          <Row wrap gap={4}>
            {(scope?.allow ?? []).map((pattern) => (
              <GlobChip key={pattern} pattern={pattern} kind="allow" />
            ))}
            {(scope?.deny ?? []).map((pattern) => (
              <GlobChip key={pattern} pattern={pattern} kind="deny" />
            ))}
          </Row>
        }
      />

      {!live ? (
        <Banner tone="warn" title={t('audit.notRun')} body={t('audit.notRunHow')} />
      ) : null}

      {live && !report.scope_defined && report.task_id ? (
        <Banner tone="warn" title={t('audit.noScope')} />
      ) : null}
      {live && !report.base_available ? <Banner tone="warn" title={t('audit.noBase')} /> : null}

      {live ? (
        <Banner
          tone={report.clean && checkedAnything ? 'success' : report.clean ? 'info' : 'error'}
          title={
            !checkedAnything
              ? t('audit.nothingChecked')
              : report.clean
                ? t('audit.clean', { count: changedTotal(report) })
                : t('audit.violations', { count: report.violations })
          }
          body={
            <Stack gap={6}>
              {report.notes.map((note) => (
                <span className="sm t2" key={note}>
                  {note}
                </span>
              ))}
              <CommandBlock command={command} exitCode={report.clean ? 0 : 1} />
            </Stack>
          }
        />
      ) : (
        <CommandBlock command={command} />
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
          gap: 'var(--gap-section)',
        }}
      >
        <Panel title={`${t('audit.inScope')} · ${report.in_scope.length}`}>
          <PathList paths={report.in_scope} empty={t('common.none')} />
        </Panel>
        <Panel title={`${t('audit.outOfScope')} · ${report.out_of_scope.length}`}>
          <PathList paths={report.out_of_scope} empty={t('common.none')} />
        </Panel>
        <Panel title={`${t('audit.forbidden')} · ${report.forbidden.length}`}>
          {report.forbidden.length === 0 ? (
            <span className="sm t3">{t('common.none')}</span>
          ) : (
            <Stack gap={6}>
              {report.forbidden.map((item) => (
                <Stack gap={2} key={item.path}>
                  <span className="mono sm">{item.path}</span>
                  <span className="xs t3">{t('audit.matched', { pattern: item.pattern })}</span>
                </Stack>
              ))}
            </Stack>
          )}
        </Panel>
        <Panel title={`${t('audit.incidental')} · ${report.incidental.length}`}>
          <PathList paths={report.incidental} empty={t('common.none')} />
        </Panel>
      </div>

      <Panel
        title={t('audit.integrity')}
        aside={
          <span className={`chip ${integrityClean(report.integrity) ? 's-passed' : 's-failed'}`}>
            <Icon name={integrityClean(report.integrity) ? 'passed' : 'failed'} />
            {integrityClean(report.integrity) ? t('audit.integrityClean') : t('audit.integrity')}
          </span>
        }
      >
        <Row wrap gap={24}>
          <Stack gap={4}>
            <span className="xs t3">{t('audit.integrity.changed')}</span>
            <PathList paths={report.integrity?.changed ?? []} empty={t('common.none')} />
          </Stack>
          <Stack gap={4}>
            <span className="xs t3">{t('audit.integrity.missing')}</span>
            <PathList paths={report.integrity?.missing ?? []} empty={t('common.none')} />
          </Stack>
          <Stack gap={4}>
            <span className="xs t3">{t('audit.integrity.unlocked')}</span>
            <PathList paths={report.integrity?.unlocked ?? []} empty={t('common.none')} />
          </Stack>
        </Row>
      </Panel>

      <Panel title={t('audit.guardTimeline')} aside={<span className="count-badge">{guardEvents.length}</span>}>
        {guardEvents.length === 0 ? (
          <span className="sm t3">{t('common.none')}</span>
        ) : (
          <Timeline
            events={guardEvents.map((event) => ({
              at: relativeTime(event.at, locale),
              title: (
                <>
                  <span className="mono">{event.file}</span>
                  {event.pattern ? ` · ${t('audit.matched', { pattern: event.pattern })}` : ''}
                </>
              ),
              detail: (
                <span title={absoluteTime(event.at, locale)}>
                  {event.outcome === 'refused'
                    ? t('audit.guard.refused')
                    : event.outcome === 'allowed-once'
                      ? t('audit.guard.allowedOnce')
                      : event.outcome === 'handed-off'
                        ? t('audit.guard.handedOff')
                        : event.allow
                          ? `${t('prompt.inScope')} ${event.allow.join(', ')}`
                          : ''}
                </span>
              ),
              tone: event.decision,
            }))}
          />
        )}
      </Panel>

    </div>
  );
}

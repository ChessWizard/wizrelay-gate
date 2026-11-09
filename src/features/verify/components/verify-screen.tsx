import { notFound } from 'next/navigation';
import { findGateState } from '@/core/relay/derive';
import { parseVerification } from '@/core/packages/parsers';
import type { AuditReport } from '@/core/audit/types';
import { audit as runAudit } from '@/services/cli/wizrelay';
import { criteriaForRole, readPackage } from '@/services/packages/files';
import { loadRelay } from '@/services/relays/service';
import { getWorkspace } from '@/services/store/store';
import { createTranslator } from '@/shared/i18n/translate';
import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/icons';
import {
  Banner,
  CommandBlock,
  LinkButton,
  Panel,
  Row,
  SectionHeader,
  Stack,
} from '@/shared/ui/primitives';
import { Table, TableBox } from '@/shared/ui/data';
import { StatusChip } from '@/shared/ui/status';
import { PromptCard } from '@/features/gate-prompts/components/prompt-card';

/**
 * S10 — the verification report.
 *
 * `NOT COVERED` is a first-class result and is drawn in its own neutral register: it is
 * not a failure, it is the most useful thing the report can tell you.
 */
export async function VerifyScreen({ relayId, role }: { relayId: string; role?: string }) {
  const relay = await loadRelay(relayId);
  if (!relay) notFound();
  const workspace = await getWorkspace();
  const t = createTranslator(workspace.locale);

  const activeRole = role && relay.roles.includes(role) ? role : relay.roles[0];
  const state = findGateState(relay, 'verify', activeRole)?.state;
  const openPrompt = state?.prompts.find((prompt) => prompt.status === 'open');

  const { files, criteria: allCriteria } = await readPackage(workspace, relay.id, activeRole);
  const verificationText =
    files.find((candidate) => candidate.path === 'verification.md')?.body ?? '';
  const report = verificationText ? parseVerification(verificationText) : null;

  const criteria = criteriaForRole(allCriteria, activeRole).map((criterion) => {
    const row = report?.results.find((candidate) => candidate.id === criterion.id);
    return {
      ...criterion,
      result: row?.result ?? criterion.result,
      evidence: row?.evidence ? { command: row.evidence } : criterion.evidence,
    };
  });

  const covered = criteria.filter((criterion) => criterion.result === 'PASS').length;
  const notCovered = criteria.filter((criterion) => criterion.result === 'NOT COVERED');
  const failed = criteria.filter((criterion) => criterion.result === 'FAIL');
  const verdict = report?.verdict ?? state?.verdict;

  const repo = workspace.repos.find((candidate) => candidate.role === activeRole);
  let auditReport: AuditReport | null = null;
  if (workspace.mode === 'live' && repo) {
    const result = await runAudit(repo.path, { base: repo.baseRef });
    if (result.ok && result.data && !('skipped' in result.data)) auditReport = result.data;
  }

  const evidenceCommands = [
    ...new Set(
      criteria
        .map((criterion) => criterion.evidence?.command ?? criterion.verification)
        .filter((command): command is string => Boolean(command)),
    ),
  ];

  const trackerComment = `[WIZRELAY-VERIFY] ${relay.id} — ${activeRole ?? ''} — ${verdict ?? '—'}`;

  const resultClass = (result?: string) =>
    result === 'PASS' ? 's-passed' : result === 'FAIL' ? 's-failed' : 's-skipped';

  return (
    <div className="page">
      <SectionHeader
        level={1}
        title={t('verify.title')}
        note={`${relay.id} · ${activeRole}`}
        actions={
          <Row wrap gap={10}>
            <StatusChip status={state?.status ?? 'idle'} t={t} size="full" />
            <LinkButton href={`/relay/${relay.id}?role=${activeRole}&gate=verify`} size="sm">
              {t('common.open')}
            </LinkButton>
          </Row>
        }
      />

      {!report ? (
        <Banner tone="warn" title={t('verify.noReport')} body={t('verify.noReportHow')} />
      ) : null}

      <Panel
        title={t('verify.verdict')}
        aside={
          verdict ? (
            <span
              className={cn(
                'chip chip-lg',
                verdict === 'PASS' ? 's-passed' : verdict === 'PARTIAL' ? 's-warned' : 's-failed',
              )}
            >
              <Icon
                name={verdict === 'PASS' ? 'passed' : verdict === 'PARTIAL' ? 'warned' : 'failed'}
              />
              {t(`verdict.${verdict}` as 'verdict.PASS')}
            </span>
          ) : (
            <span className="chip chip-lg s-idle">
              <Icon name="idle" />
              {t('check.notRun')}
            </span>
          )
        }
      >
        <Stack gap={8}>
          <span className="sm t2">
            {t('verify.counts', {
              passed: covered,
              failed: failed.length,
              notCovered: notCovered.length,
              total: criteria.length,
            })}
          </span>
          <Row gap={10}>
            <span className="xs t3">{t('verify.agent')}</span>
            <span className="mono sm">{report?.agent ?? t('common.none')}</span>
          </Row>
          <span className="xs t3">{t('verify.capRule')}</span>
        </Stack>
      </Panel>

      {openPrompt ? (
        <PromptCard relayId={relay.id} role={activeRole} gate="verify" prompt={openPrompt} />
      ) : null}

      <Panel title={t('verify.criteria')}>
        <TableBox>
          <Table
            label={t('verify.criteria')}
            head={
              <tr>
                <th className="mono">{t('verify.criterion')}</th>
                <th>{t('board.column.title')}</th>
                <th>{t('verify.result')}</th>
                <th>{t('verify.evidence')}</th>
              </tr>
            }
          >
            {criteria.map((criterion) => (
              <tr key={criterion.id} className={criterion.result === 'NOT COVERED' ? 'is-hl' : undefined}>
                <td className="mono strong">{criterion.id}</td>
                <td>{criterion.title}</td>
                <td>
                  <span className={cn('chip', resultClass(criterion.result))}>
                    <Icon
                      name={
                        criterion.result === 'PASS'
                          ? 'passed'
                          : criterion.result === 'FAIL'
                            ? 'failed'
                            : 'skipped'
                      }
                    />
                    {criterion.result === 'NOT COVERED'
                      ? t('result.notCovered')
                      : criterion.result ?? t('check.notRun')}
                  </span>
                </td>
                <td>
                  {criterion.evidence ? (
                    <Stack gap={2}>
                      <span className="mono xs">{criterion.evidence.command}</span>
                      {criterion.evidence.output ? (
                        <span className="xs t3">{criterion.evidence.output}</span>
                      ) : null}
                    </Stack>
                  ) : (
                    <span className="xs t3">{t('common.none')}</span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </TableBox>
      </Panel>

      <Panel title={t('verify.suite')}>
        {evidenceCommands.length === 0 ? (
          <span className="sm t3">{t('common.none')}</span>
        ) : (
          <Stack gap={6}>
            {evidenceCommands.map((command) => (
              <CommandBlock key={command} command={command} />
            ))}
          </Stack>
        )}
      </Panel>

      <Panel title={t('verify.notVerified')}>
        {notCovered.length === 0 && !report?.notVerified ? (
          <span className="sm t3">{t('common.none')}</span>
        ) : (
          <Stack gap={10}>
            {notCovered.map((criterion) => (
              <Stack gap={4} key={criterion.id}>
                <Row gap={8}>
                  <span className="mono strong">{criterion.id}</span>
                  <span className="chip s-skipped">
                    <Icon name="skipped" />
                    {t('result.notCovered')}
                  </span>
                </Row>
                <span className="sm">{criterion.title}</span>
                {criterion.verification ? (
                  <Stack gap={2}>
                    <span className="xs t3">{t('verify.suggestedTest')}</span>
                    <span className="mono sm">{criterion.verification}</span>
                  </Stack>
                ) : null}
              </Stack>
            ))}
            {report?.notVerified ? <div className="out">{report.notVerified}</div> : null}
          </Stack>
        )}
      </Panel>

      <Panel title={t('audit.title')}>
        <Stack gap={8}>
          {auditReport ? (
            <Banner
              tone={auditReport.clean ? 'success' : 'error'}
              inline
              title={
                auditReport.clean
                  ? t('audit.clean', { count: auditReport.in_scope.length })
                  : t('audit.violations', { count: auditReport.out_of_scope.length })
              }
            />
          ) : report?.auditText ? (
            <div className="out">{report.auditText}</div>
          ) : (
            <span className="sm t3">{t('verify.noAudit')}</span>
          )}
          <LinkButton href={`/relay/${relay.id}/audit?role=${activeRole}`} size="sm">
            {t('audit.title')}
          </LinkButton>
        </Stack>
      </Panel>

      <Panel title={t('verify.trackerPreview')}>
        <div className="payload">
          <div className="payload-h">
            <span>{t('verify.trackerPreview')}</span>
            <span className="grow" />
            <span className="mono xs">{relay.tracker.type}</span>
          </div>
          <pre>{trackerComment}</pre>
        </div>
      </Panel>
    </div>
  );
}

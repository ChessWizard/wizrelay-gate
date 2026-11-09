import { notFound } from 'next/navigation';
import type { Finding } from '@/core/relay/types';
import { hubValidate } from '@/services/cli/wizrelay';
import { hubDirectory, readPackage } from '@/services/packages/files';
import { loadRelay } from '@/services/relays/service';
import { getWorkspace } from '@/services/store/store';
import { createTranslator } from '@/shared/i18n/translate';
import { Icon } from '@/shared/ui/icons';
import { Banner, CommandBlock, LinkButton, Panel, Row, SectionHeader, Stack } from '@/shared/ui/primitives';
import { FindingRow } from '@/shared/ui/data';

/**
 * S7 — the validate report.
 *
 * The verdict is the plugin's, never this app's: `wizrelay hub validate` runs in the hub's
 * working copy and its lines are what the two lists show. When the CLI is not installed
 * the screen says so and falls back to the one thing the dashboard can see for itself —
 * `{{placeholder}}` markers still in the files — labelled as exactly that, because a
 * placeholder count is an observation, not a validation.
 *
 * Blocking and advisory never share a list, and the footer says the rule out loud: errors
 * block publication, warnings do not.
 */
export async function ValidateScreen({ relayId }: { relayId: string }) {
  const relay = await loadRelay(relayId);
  if (!relay) notFound();
  const workspace = await getWorkspace();
  const t = createTranslator(workspace.locale);

  const hubDir = hubDirectory(workspace);
  const result = hubDir ? await hubValidate(hubDir, relay.id) : null;

  let findings: Finding[] = [];
  let command = `wizrelay hub validate ${relay.id} --no-fail`;
  let exitCode: number | undefined;
  let live = false;

  if (result?.ok && result.data) {
    findings = result.data.map((line, index) => ({
      id: `V-${index + 1}`,
      severity: line.level === 'error' ? 'blocking' : 'advisory',
      source: 'validate',
      message: line.message,
      loc: line.loc,
    }));
    command = result.command;
    exitCode = result.exitCode;
    live = true;
  } else if (result?.command) {
    command = result.command;
  }

  const observed: Finding[] = [];
  if (!live) {
    const { files } = await readPackage(workspace, relay.id);
    for (const file of files) {
      if (!file.placeholders) continue;
      observed.push({
        id: `P-${file.path}`,
        severity: 'advisory',
        source: 'validate',
        message: t('validate.placeholdersIn', { count: file.placeholders, file: file.path }),
        loc: file.path,
      });
    }
  }

  const blocking = findings.filter((finding) => finding.severity === 'blocking');
  const advisory = [...findings.filter((finding) => finding.severity === 'advisory'), ...observed];

  return (
    <div className="page">
      <SectionHeader
        level={1}
        title={t('validate.title')}
        note={`${relay.id} · v${relay.version}`}
        actions={
          <Row wrap gap={10}>
            <LinkButton href={`/package/${relay.id}`} size="sm">
              {t('package.title')}
            </LinkButton>
            <LinkButton
              href={`/relay/${relay.id}?gate=validate`}
              size="sm"
              variant="primary"
              icon="relay"
            >
              {t('validate.rerun')}
            </LinkButton>
          </Row>
        }
      />

      {!live ? (
        <Banner
          tone="warn"
          title={
            result?.unavailable || !result
              ? t('validate.noCli')
              : t('validate.failed', { detail: result.stderr ?? t('error.commandFailed') })
          }
          body={t('validate.noCliBody')}
        />
      ) : null}
      {!hubDir ? <Banner tone="warn" title={t('validate.noHub')} /> : null}

      <CommandBlock command={command} exitCode={exitCode} />

      <Panel
        title={
          <Row gap={8}>
            <Icon name="failed" className="ink-failed" />
            <span>{t('validate.blocking')}</span>
          </Row>
        }
        aside={<span className="count-badge">{blocking.length}</span>}
        bodyClassName="checks"
      >
        {blocking.length === 0 ? (
          <span className="sm t3">{live ? t('validate.clean') : t('validate.unknown')}</span>
        ) : (
          <div className="checks">
            {blocking.map((finding) => (
              <FindingRow
                key={finding.id}
                finding={finding}
                t={t}
                action={
                  <LinkButton href={`/relay/${relay.id}?gate=research`} size="sm">
                    {t('validate.fixWithClaude')}
                  </LinkButton>
                }
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title={
          <Row gap={8}>
            <Icon name="warned" className="ink-warned" />
            <span>{t('validate.advisory')}</span>
          </Row>
        }
        aside={<span className="count-badge">{advisory.length}</span>}
      >
        {advisory.length === 0 ? (
          <div className="panel-b">
            <span className="sm t3">{live ? t('validate.clean') : t('validate.unknown')}</span>
          </div>
        ) : (
          <div className="checks">
            {advisory.map((finding) => (
              <FindingRow
                key={finding.id}
                finding={finding}
                t={t}
                action={
                  <LinkButton
                    href={`/package/${relay.id}?file=${encodeURIComponent(
                      finding.loc?.split(':')[0] ?? '',
                    )}`}
                    size="sm"
                  >
                    {t('validate.openFile')}
                  </LinkButton>
                }
              />
            ))}
          </div>
        )}
      </Panel>

      <Stack gap={8}>
        <Banner tone="info" inline title={t('validate.footer')} body={t('validate.criticIdentity')} />
      </Stack>
    </div>
  );
}

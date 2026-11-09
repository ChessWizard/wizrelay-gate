import { DEFAULT_POLICY } from '@/core/routing/policy';
import { relativeTime } from '@/core/time/format';
import { environment } from '@/services/workspace/connect';
import { requireUser } from '@/services/auth/context';
import { activeContext } from '@/services/panel/active';
import { prisma } from '@/services/db/client';
import { getLocale } from '@/services/panel/locale';
import { createTranslator } from '@/shared/i18n/translate';
import { KeyValues, Panel, Row, SectionHeader, Stack } from '@/shared/ui/primitives';
import { Table, TableBox } from '@/shared/ui/data';
import { Icon } from '@/shared/ui/icons';
import { ApprovalPanel } from './approval-panel';
import { Hint } from '@/shared/ui/hint';
import { TodoList } from '@/features/guide/components/todo-list';
import { AppearanceControls } from './appearance-controls';
import { Diagnostics } from './diagnostics';
import { PasswordForm } from './password-form';

const LEVEL_CLASS = { error: 's-failed', warn: 's-warned', info: 's-passed' } as const;
const LEVEL_ICON = { error: 'failed', warn: 'warned', info: 'passed' } as const;

export async function SettingsScreen() {
  const { user, viewer } = await requireUser();
  const locale = await getLocale();
  const t = createTranslator(locale);

  const context = await activeContext();
  const [panel, account] = await Promise.all([
    prisma.panel.findUnique({ where: { id: 'panel' } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { passwordSetAt: true } }),
  ]);
  const checks = await environment(context.projects[0]?.localPath ?? undefined);

  return (
    <div className="page">
      <SectionHeader level={1} title={t('settings.title')} />

      <TodoList />

      <Panel title={t('settings.security')}>
        <Stack gap={12}>
          <PasswordForm bootstrap={account?.passwordSetAt === null} />
          {account?.passwordSetAt ? (
            <span className="xs t3">
              {t('settings.passwordSet')}: {relativeTime(account.passwordSetAt.toISOString(), locale)}
            </span>
          ) : null}
        </Stack>
      </Panel>

      <ApprovalPanel />

      <Panel title={t('settings.appearance')}>
        <AppearanceControls
          direction={(panel?.direction ?? 'a') as 'a' | 'b'}
          theme={(panel?.theme ?? 'dark') as 'light' | 'dark' | 'system'}
        />
      </Panel>

      {context.hub ? (
        <Panel title={t('hub.title')}>
          <KeyValues
            items={[
              {
                key: (
                  <span className="row" style={{ gap: '6px' }}>
                    {t('settings.hubUrl')}
                    <Hint title={t('hub.title')}>{t('hint.hubCopy')}</Hint>
                  </span>
                ),
                value: <span className="mono">{context.hub.url}</span>,
              },
              { key: t('settings.hubBranch'), value: context.hub.branch },
              {
                key: t('settings.tracker'),
                value: context.hub.trackerType
                  ? `${context.hub.trackerType} · ${context.hub.trackerPrefix ?? ''}`
                  : t('common.none'),
              },
              {
                key: t('project.title'),
                value: context.projects.map((project) => project.role).join(' · ') || t('common.none'),
              },
            ]}
          />
        </Panel>
      ) : null}

      <Panel
        title={
          <span className="row" style={{ gap: '6px' }}>
            {t('routing.policy.default')}
            <Hint title={t('routing.policy.default')}>{t('hint.routingPolicy')}</Hint>
          </span>
        }
        aside={
          <Hint align="end" title={t('settings.policySource')}>
            {t('hint.policySource')}
          </Hint>
        }
      >

        <Stack gap={10}>
          <span className="sm t2">{t('routing.policy.how')}</span>
          <TableBox>
            <Table
              label={t('routing.policy.default')}
              head={
                <tr>
                  <th>{t('routing.tier')}</th>
                  <th>{t('routing.score')}</th>
                  <th>{t('gate.plan')}</th>
                  <th>{t('gate.implement')}</th>
                  <th>{t('gate.verify')}</th>
                </tr>
              }
            >
              {DEFAULT_POLICY.tiers.map((tier, index) => {
                const from = index === 0 ? 0 : DEFAULT_POLICY.tiers[index - 1].max_score + 1;
                return (
                  <tr key={tier.name}>
                    <td className="mono">{tier.name}</td>
                    <td className="mono t3">
                      {from}–{tier.max_score === 99 ? '∞' : tier.max_score}
                    </td>
                    {(['plan', 'implement', 'verify'] as const).map((phase) => (
                      <td className="mono" key={phase}>
                        {tier.phases[phase].model} / {tier.phases[phase].effort}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </Table>
          </TableBox>
          <span className="xs t3">{t('routing.policy.score')}</span>
        </Stack>
      </Panel>

      <Panel
        title={
          <span className="row" style={{ gap: '6px' }}>
            {t('settings.diagnostics')}
            <Hint title={t('settings.diagnostics')}>{t('hint.diagnostics')}</Hint>
          </span>
        }
        aside={
          <Diagnostics
            passed={checks.filter((check) => check.level === 'info').length}
            total={checks.length}
            failed={checks.filter((check) => check.level === 'error').length}
          />
        }
        bodyClassName="checks"
      >
        <div className="panel-b">
          <span className="sm t2">{t('settings.diagnosticsLead')}</span>
        </div>
        <div className="checks">
          {checks.map((check) => (
            <div className="check" key={`${check.name}-${check.detail}`}>
              <span className={`ci ${LEVEL_CLASS[check.level]}`}>
                <Icon name={LEVEL_ICON[check.level]} />
              </span>
              <Stack gap={2}>
                <span className="sm strong">{check.name}</span>
                <span className="xs t3 mono trunc">{check.detail}</span>
                {check.fix ? <code className="out">{check.fix}</code> : null}
              </Stack>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={t('settings.privacy')}>
        <Row wrap gap={10}>
          <span className="sm t2">{t('settings.privacyBody')}</span>
          <span className="xs t3">
            {t('people.lastSeen')}: {relativeTime(new Date().toISOString(), locale)}
          </span>
          <span className="chip s-idle">{t(`role.${viewer.globalRole}` as 'role.ADMIN')}</span>
        </Row>
      </Panel>
    </div>
  );
}

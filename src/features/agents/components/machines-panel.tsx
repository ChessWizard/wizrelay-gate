import { isAgentOnline } from '@/core/agent/protocol';
import { relativeTime } from '@/core/time/format';
import { requireUser } from '@/services/auth/context';
import { AGENT_BINARIES } from '@/core/agent/protocol';
import { listAgents, reposOf } from '@/services/agent/registry';
import { executionMode } from '@/services/agent/placement';
import { getLocale } from '@/services/panel/locale';
import { createTranslator } from '@/shared/i18n/translate';
import { Icon } from '@/shared/ui/icons';
import { Banner, Empty, Panel, Row, Stack } from '@/shared/ui/primitives';
import { MetaBadge } from '@/shared/ui/track-badges';
import { PairCard } from './pair-card';
import { RevokeAgent } from './revoke-agent';

/**
 * The machines this person has paired.
 *
 * A panel on a server cannot run a gate, and this is the screen that says so and fixes it.
 * It shows what each machine told the panel about itself — the checkouts it offers, the
 * tools it found, the Claude account it is signed in to — because those are exactly the
 * three things that decide whether a gate will run, and a person debugging "why is the
 * button grey" should not have to guess which one is missing.
 */
export async function MachinesPanel({ panelUrl }: { panelUrl: string }) {
  const { user } = await requireUser();
  const t = createTranslator(await getLocale());
  const locale = await getLocale();
  const agents = await listAgents(user.id);
  const mode = executionMode();

  return (
    <Panel
      title={t('agent.title')}
      aside={
        <span className={`chip ${agents.some((a) => isAgentOnline(a.lastSeenAt)) ? 's-passed' : 's-idle'}`}>
          <Icon name={agents.some((a) => isAgentOnline(a.lastSeenAt)) ? 'passed' : 'idle'} />
          {t('agent.count', { count: agents.filter((a) => isAgentOnline(a.lastSeenAt)).length })}
        </span>
      }
    >
      <Stack gap={12}>
        <span className="sm t2">{t('agent.lead')}</span>

        {mode === 'agent' && agents.length === 0 ? (
          <Banner tone="warn" inline title={t('agent.requiredHere')} />
        ) : null}

        {agents.length === 0 ? (
          <Empty title={t('agent.none')} body={t('agent.noneHow')} />
        ) : (
          <Stack gap={10}>
            {agents.map((agent) => {
              const online = isAgentOnline(agent.lastSeenAt);
              const repos = reposOf(agent);
              return (
                <div className="card stack" key={agent.id} style={{ gap: '8px' }}>
                  <div className="row spread wrap" style={{ gap: '8px' }}>
                    <Row wrap gap={8}>
                      <span className={`chip ${online ? 's-running' : 's-idle'}`}>
                        <Icon name={online ? 'pulse' : 'idle'} />
                        {t(online ? 'agent.online' : 'agent.offline')}
                      </span>
                      <span className="strong">{agent.name}</span>
                      <span className="mono xs t3">{agent.platform ?? ''}</span>
                    </Row>
                    <Row wrap gap={8}>
                      <span className="xs t3">
                        {agent.lastSeenAt
                          ? t('agent.lastSeen', { age: relativeTime(agent.lastSeenAt.toISOString(), locale) })
                          : t('common.none')}
                      </span>
                      <RevokeAgent agentId={agent.id} name={agent.name} />
                    </Row>
                  </div>

                  <Row wrap gap={6}>
                    <MetaBadge
                      icon="user"
                      label={t('agent.claudeAccount')}
                      value={agent.claudeEmail ?? t('agent.claudeMissing')}
                      tone={agent.claudeEmail ? undefined : 'warn'}
                    />
                    <MetaBadge icon="cpu" label={t('agent.version')} value={agent.version ?? '—'} />
                  </Row>

                  <Row wrap gap={6}>
                    {AGENT_BINARIES.map((binary) => {
                      const found = Boolean((agent.binaries as Record<string, boolean> | null)?.[binary]);
                      return (
                        <span key={binary} className={`chip ${found ? 's-passed' : 's-failed'}`}>
                          <Icon name={found ? 'passed' : 'failed'} />
                          {binary}
                        </span>
                      );
                    })}
                  </Row>

                  {repos.length === 0 ? (
                    <span className="xs ink-warned">{t('agent.noRepos')}</span>
                  ) : (
                    <Stack gap={4}>
                      {repos.map((entry) => (
                        <Row key={`${agent.id}-${entry.role}`} wrap gap={8}>
                          <span className="chip s-idle mono">{entry.role}</span>
                          <span className="mono xs t3 trunc">{entry.path}</span>
                          {entry.branch ? <span className="xs t3">{entry.branch}</span> : null}
                        </Row>
                      ))}
                    </Stack>
                  )}
                </div>
              );
            })}
          </Stack>
        )}

        <PairCard panelUrl={panelUrl} />
      </Stack>
    </Panel>
  );
}

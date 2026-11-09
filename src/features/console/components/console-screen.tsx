import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GATES, isGateId } from '@/core/gates/gates';
import { findGateState } from '@/core/relay/derive';
import { route } from '@/core/routing/routing';
import { loadRelay } from '@/services/relays/service';
import { getWorkspace } from '@/services/store/store';
import { history } from '@/services/engine/runner';
import { claudeAvailable } from '@/services/engine/claude';
import { createTranslator } from '@/shared/i18n/translate';
import { KeyValues, Panel, Row, Stack, VersionChip } from '@/shared/ui/primitives';
import { GlobList } from '@/shared/ui/glob-list';
import { gateResult, StatusChip } from '@/shared/ui/status';
import { Flow } from '@/features/pipeline/components/flow';
import { FollowRun } from '@/features/pipeline/components/follow-run';
import { currentSession } from '@/services/auth/session';
import { mentionablePeople } from '@/services/panel/mentionable';
import { ConsoleStream } from './console-stream';

/** S4 — the gate console: a job log you can talk to. */
export async function ConsoleScreen({
  relayId,
  gate,
  role,
}: {
  relayId: string;
  gate: string;
  role?: string;
}) {
  if (!isGateId(gate)) notFound();
  const relay = await loadRelay(relayId);
  if (!relay) notFound();

  const workspace = await getWorkspace();
  const locale = workspace.locale;
  const t = createTranslator(locale);

  const session = await currentSession();
  const people = session ? await mentionablePeople(session.user.id) : [];

  const activeRole = role && relay.roles.includes(role) ? role : relay.roles[0];
  const selectedRole = GATES[gate].track === 'research' ? undefined : activeRole;
  const found = findGateState(relay, gate, selectedRole);
  const state = found?.state;
  const track = found?.track;

  const events = await history(relay.id, selectedRole, gate);
  const hasClaude = await claudeAvailable();
  const engineLabel =
    workspace.mode === 'live' && hasClaude && GATES[gate].conversational
      ? t('console.engine.claude')
      : t('console.engine.scripted');

  const scope = activeRole ? relay.scope[activeRole] : undefined;
  const routing = activeRole
    ? route({
        signals: relay.routing?.signals ?? { complexity: 'medium', risk: 'medium', ambiguity: 'medium' },
        roleSignals: relay.routing?.role_signals?.[activeRole],
        role: activeRole,
        taskId: relay.id,
        title: relay.title,
        scope,
        profile: workspace.repos.find((repo) => repo.role === activeRole)?.profile,
      })
    : null;

  const phase =
    gate === 'plan' ? 'plan' : gate === 'verify' ? 'verify' : gate === 'implement' ? 'implement' : 'ask';
  const setting = routing?.phases[phase];
  const modelLine = setting
    ? `${setting.model} / ${setting.effort} · ${phase} · ${routing?.tier}`
    : `${phase}`;

  const openQuestions = relay.questions.filter((item) => item.status === 'OPEN').length;

  return (
    <div className="page">
      <div className="run console-open">
        <section className="run-head row spread wrap" style={{ gap: '10px' }}>
          <Row wrap gap={10}>
            <h2>{relay.title}</h2>
            <VersionChip>
              {t('run.researchVersion')} v{relay.version}
            </VersionChip>
            <span className="mono sm t3">
              {activeRole} · {relay.id}
            </span>
            {state ? <StatusChip status={state.status} t={t} /> : null}
            <FollowRun
              relayId={relay.id}
              role={selectedRole}
              running={
                (track?.gates ?? []).find((item) => item.status === 'running')?.gate ?? null
              }
            />
          </Row>
        </section>

        <section className="run-rail">
          <Flow
            stages={(track?.gates ?? []).map((item) => ({
              gate: item.gate,
              status: item.status,
              durationMs: item.durationMs,
              selected: item.gate === gate,
              result: gateResult(item, t),
              href: `/relay/${relay.id}/gate/${item.gate}/console${
                selectedRole ? `?role=${selectedRole}` : ''
              }`,
            }))}
            t={t}
            locale={locale}
            label={track ? t(`track.${track.id}` as 'track.delivery') : undefined}
          />
        </section>

        <ConsoleStream
          relayId={relay.id}
          role={selectedRole}
          gate={gate}
          initial={events}
          initialPrompt={state?.prompts.find((prompt) => prompt.status === 'open') ?? null}
          engineLabel={engineLabel}
          modelLine={modelLine}
          belowTier={false}
          people={people}
          closeHref={`/relay/${relay.id}?role=${activeRole ?? ''}&gate=${gate}`}
        />

        <aside className="run-ctx">
          <Panel
            title={t('run.context.progress')}
            aside={state ? <StatusChip status={state.status} t={t} /> : undefined}
          >
            <KeyValues
              items={[
                { key: t('run.planSteps'), value: String(state?.metrics?.steps ?? t('common.none')) },
                { key: t('run.tests'), value: String(state?.metrics?.tests ?? t('common.none')) },
                {
                  key: t('run.guard'),
                  value: `${(state?.guardEvents ?? []).filter((event) => event.decision === 'deny').length} ${t(
                    'audit.guard.deny',
                  )} · ${(state?.guardEvents ?? []).filter((event) => event.decision === 'ask').length} ${t(
                    'audit.guard.ask',
                  )}`,
                },
                { key: t('run.context.questions'), value: String(openQuestions) },
                { key: t('run.researchVersion'), value: `v${relay.version}` },
              ]}
            />
          </Panel>
          <Panel title={t('run.context.scope')} aside={<span className="mono xs t3">{relay.enforcement}</span>}>
            <GlobList allow={scope?.allow ?? []} deny={scope?.deny ?? []} initial={6} />
          </Panel>
          <Panel title={t('run.openPackage')}>
            <Stack gap={6}>
              <Link className="sm" href={`/package/${relay.id}`}>
                {t('package.title')}
              </Link>
              <Link className="sm" href={`/relay/${relay.id}/audit?role=${activeRole ?? ''}`}>
                {t('audit.title')}
              </Link>
              <Link className="sm" href={`/relay/${relay.id}/verify?role=${activeRole ?? ''}`}>
                {t('verify.title')}
              </Link>
            </Stack>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GATES, isGateId } from '@/core/gates/gates';
import { planGate } from '@/core/gates/steps';
import type { GateId } from '@/core/gates/gates';
import { currentGate, findGateState, hasWorkInFlight } from '@/core/relay/derive';
import type { GateState, Relay, Track } from '@/core/relay/types';
import { route } from '@/core/routing/routing';
import { absoluteTime, formatDuration, relativeTime } from '@/core/time/format';
import { loadRelay } from '@/services/relays/service';
import { canRunHere, placeRun } from '@/services/agent/placement';
import { currentSession } from '@/services/auth/session';
import { getWorkspace } from '@/services/store/store';
import { history } from '@/services/engine/runner';
import { createTranslator } from '@/shared/i18n/translate';
import type { Locale } from '@/shared/i18n/config';
import { Icon } from '@/shared/ui/icons';
import {
  Banner,
  CommandBlock,
  KeyValues,
  LinkButton,
  OwnershipBadge,
  Row,
  Stack,
  VersionChip,
} from '@/shared/ui/primitives';
import { CheckRow } from '@/shared/ui/data';
import { GlobList } from '@/shared/ui/glob-list';
import { Expand } from '@/shared/ui/expand';
import { gateResult, StatusChip } from '@/shared/ui/status';
import { MetaBadge, TrackBadges } from '@/shared/ui/track-badges';
import { Flow, FlowProgress, type FlowStage } from '@/features/pipeline/components/flow';
import { LiveRefresh } from '@/features/pipeline/components/live-refresh';
import { FollowRun } from '@/features/pipeline/components/follow-run';
import { PromptCard } from '@/features/gate-prompts/components/prompt-card';
import { criteriaForRole, readPackage } from '@/services/packages/files';
import { GateActions } from './gate-actions';
import { RemoveRelay } from './remove-relay';
import { GatePane } from './gate-pane';
import { QuestionLoop } from './handoff-lane';
import { RoleSwitch } from './role-switch';
import { ContextTabs } from './context-tabs';
import { GateSteps } from './gate-steps';
import { TrackActions } from './track-actions';

export interface RunScreenProps {
  relayId: string;
  role?: string;
  gate?: string;
}

function gateHref(relayId: string, role: string | undefined, gate: GateId): string {
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  params.set('gate', gate);
  return `/relay/${relayId}?${params.toString()}`;
}

function ownerLabel(gate: GateId, t: ReturnType<typeof createTranslator>): string {
  const owner = GATES[gate].owner;
  if (owner === 'ci') return 'CI';
  return owner === 'researcher' ? t('top.persona.researcher') : t('top.persona.developer');
}

function stagesOf(
  track: Track | undefined,
  relayId: string,
  role: string | undefined,
  selected: GateId,
  t: ReturnType<typeof createTranslator>,
): FlowStage[] {
  return (track?.gates ?? []).map((state) => ({
    gate: state.gate,
    status: state.status,
    durationMs: state.durationMs,
    href: gateHref(relayId, role, state.gate),
    selected: state.gate === selected,
    result: gateResult(state, t),
  }));
}

/**
 * S3 — the relay run: the pipeline, the selected gate, and the context it needs.
 *
 * The pipeline is the flow rather than two rails of labelled cards, and the four context
 * panels are tabs. What changed is how much is on screen at once, not what is reachable:
 * every number, glob and command that was here is still here, one click deeper.
 */
export async function RunScreen({ relayId, role, gate }: RunScreenProps) {
  const relay = await loadRelay(relayId);
  if (!relay) notFound();

  const workspace = await getWorkspace();
  const locale: Locale = workspace.locale;
  const t = createTranslator(locale);

  const roles = relay.roles;
  const activeRole = role && roles.includes(role) ? role : roles[0];
  const selected: GateId = gate && isGateId(gate) ? gate : currentGate(relay);
  const selectedRole = GATES[selected].track === 'research' ? undefined : activeRole;

  const found = findGateState(relay, selected, selectedRole);
  const state: GateState = found?.state ?? {
    gate: selected,
    status: 'idle',
    checks: [],
    prompts: [],
    artifacts: [],
  };

  const researchTrack = relay.tracks.find((track) => track.id === 'research');
  const deliveryTrack = relay.tracks.find((track) => track.role === activeRole);
  const openPrompt = state.prompts.find((prompt) => prompt.status === 'open');
  const question = relay.questions.find((candidate) => candidate.role === activeRole);
  const events = await history(relay.id, selectedRole, selected);

  const allStates = [...(researchTrack?.gates ?? []), ...(deliveryTrack?.gates ?? [])];
  const live = hasWorkInFlight(allStates, relay.updatedAt);

  const runningGate = allStates.find((candidate) => candidate.status === 'running')?.gate ?? null;
  const openQuestions = relay.questions.filter((item) => item.status === 'OPEN').length;

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

  const { criteria: allCriteria, decisions } = await readPackage(workspace, relay.id, activeRole);
  const criteria = criteriaForRole(allCriteria, activeRole);

  /**
   * The commands this gate will really run, with this relay's values in them. Whether they
   * can run is a separate question: a research gate needs the hub's working copy, a
   * delivery gate needs a repository connected for this role, and the screenshot case —
   * a role nobody has connected — must say so rather than offer a button that does nothing.
   */
  const steps = planGate(selected, {
    relayId: relay.id,
    title: relay.title,
    roles: relay.roles,
    role: activeRole,
    folder: `${relay.id}-${relay.slug}`,
    hubBranch: workspace.hub?.branch ?? 'main',
    base: workspace.repos.find((repo) => repo.role === activeRole)?.baseRef,
  });

  const session = await currentSession();
  const placement = await placeRun({ userId: session?.user.id, role: activeRole, workspace });
  const needsRepo = steps.some((step) => step.where === 'repo');
  const needsHub = steps.some((step) => step.where === 'hub');
  const hubWrites = steps.some((step) => step.where === 'hub' && !step.readOnly);
  const verdict =
    workspace.mode === 'live'
      ? canRunHere(placement, { repo: needsRepo, hub: needsHub, hubWrites })
      : ({ ok: false, reasonKey: 'steps.noHub' } as const);
  const canRun = verdict.ok;
  const blockedReason = verdict.ok
    ? undefined
    : t(verdict.reasonKey as 'steps.noHub', { role: activeRole ?? '' });
  const repoForRole = placement.repoCwd ? { path: placement.repoCwd } : undefined;
  const runsOn = placement.where === 'agent' ? placement.machine : undefined;

  const ahead = relay.hubVersion !== undefined && relay.hubVersion > relay.version;

  return (
    <>
      {ahead ? (
        <Banner
          tone="info"
          title={t('banner.hubAhead', { version: relay.hubVersion ?? 0, local: relay.version })}
          action={
            <LinkButton href={`/relay/${relay.id}?gate=pull`} size="sm" variant="primary">
              {t('banner.sync')}
            </LinkButton>
          }
        />
      ) : null}
      {relay.guardInactive ? (
        <Banner tone="error" title={t('banner.guardOff')} body={t('banner.guardOffCauses')} />
      ) : null}

      <div className="page">
        <div className="run">
          <section className="run-head stack" style={{ gap: '8px' }}>
            <div className="crumbs">
              <Link href="/">{t('board.title')}</Link>
              <span>/</span>
              <span className="mono">{relay.id}</span>
            </div>
            <div className="row spread wrap" style={{ gap: '12px' }}>
              <Stack gap={6}>
                <Row wrap gap={10}>
                  <h1>{relay.title}</h1>
                  <StatusChip status={state.status} t={t} size="full" />
                  <LiveRefresh live={live} />
                  <FollowRun relayId={relay.id} role={activeRole} running={runningGate} />
                </Row>
                <Row wrap gap={8}>
                  <span className="mono sm t2">{relay.id}</span>
                  <VersionChip ahead={ahead}>
                    {ahead ? `v${relay.version} → v${relay.hubVersion}` : `v${relay.version}`}
                  </VersionChip>
                  {relay.tracker.url ? (
                    <a className="sm" href={relay.tracker.url} target="_blank" rel="noreferrer">
                      {relay.tracker.ref} ↗
                    </a>
                  ) : null}
                  <span className="mono xs t3">{relay.enforcement}</span>
                  {relay.localOnly ? (
                    <span className="chip s-skipped">{t('board.localOnly')}</span>
                  ) : null}
                  {relay.localOnly ? <RemoveRelay relayId={relay.id} /> : null}
                </Row>
              </Stack>
              <Stack gap={8}>
                {roles.length > 1 && activeRole ? (
                  <RoleSwitch
                    relayId={relay.id}
                    gate={selected}
                    roles={roles.map((candidate) => ({
                      role: candidate,
                      repo: relay.repos[candidate],
                    }))}
                    active={activeRole}
                  />
                ) : null}
                <FlowProgress stages={allStates} current={selected} t={t} />
              </Stack>
            </div>
          </section>

          <section className="run-rail stack" style={{ gap: 'var(--space-3)' }}>
            <article className="track-card" aria-label={t('track.research')}>
              <header className="track-head">
                <div className="track-id">
                  <span className="track-name">{t('track.research')}</span>
                  <span className="track-badges">
                    {workspace.hub?.name ? (
                      <MetaBadge icon="hub" label={t('track.hub')} value={workspace.hub.name} />
                    ) : null}
                    <span className="meta-note xs">{t('track.ownerResearcher')}</span>
                  </span>
                </div>
                <TrackActions
                  relayId={relay.id}
                  role={undefined}
                  track="research"
                  disabled={workspace.mode !== 'live' || !workspace.hub}
                  disabledReason={t('steps.noHub')}
                />
              </header>
              <Flow
                stages={stagesOf(researchTrack, relay.id, activeRole, selected, t)}
                t={t}
                locale={locale}
              />
            </article>

            {deliveryTrack && activeRole ? (
              <article className="track-card" aria-label={t('track.delivery')}>
                <header className="track-head">
                  <div className="track-id">
                    <span className="track-name">{t('track.delivery')}</span>
                    <TrackBadges
                      role={activeRole}
                      repo={deliveryTrack.repo ?? relay.repos[activeRole]}
                      connected={Boolean(repoForRole)}
                      connectHref="/admin"
                      t={t}
                    />
                    <span className="meta-note xs">{t('track.ownerDeveloper')}</span>
                  </div>
                  <TrackActions
                    relayId={relay.id}
                    role={activeRole}
                    track="delivery"
                    disabled={workspace.mode !== 'live' || !repoForRole}
                    disabledReason={t('steps.noRepo', { role: activeRole })}
                  />
                </header>
                <Flow
                  stages={stagesOf(deliveryTrack, relay.id, activeRole, selected, t)}
                  t={t}
                  locale={locale}
                />
              </article>
            ) : null}

            {question ? (
              <QuestionLoop
                question={question}
                decision={decisions.find((candidate) => candidate.id === question.decisionId)}
                relayVersion={relay.version}
                hubVersion={relay.hubVersion}
                href="/questions"
                t={t}
                locale={locale}
              />
            ) : null}
          </section>

          <GatePane
            counts={{
              checks: state.checks.length,
              artifacts: state.artifacts.length,
              steps: steps.length,
            }}
            steps={
              <GateSteps
                relayId={relay.id}
                role={selectedRole}
                gate={selected}
                steps={steps}
                checks={state.checks}
                canRun={canRun}
                blockedReason={blockedReason}
              />
            }
            header={
              <div className="panel-h">
                <Row wrap gap={10}>
                  <h2>{t(`gate.${selected}` as 'gate.pull')}</h2>
                  <StatusChip status={state.status} t={t} />
                  <span className="xs t3">{ownerLabel(selected, t)}</span>
                  {state.durationMs ? (
                    <span className="mono xs t3" title={t('run.tookHelp')}>
                      {t('run.took', { duration: formatDuration(state.durationMs, locale) })}
                    </span>
                  ) : null}
                  {state.startedAt ? (
                    <span className="xs t3" title={absoluteTime(state.startedAt, locale)}>
                      {t('run.startedAt', { when: relativeTime(state.startedAt, locale) })}
                    </span>
                  ) : null}
                  {gateResult(state, t) ? (
                    <span className="sm t2 trunc">{gateResult(state, t)}</span>
                  ) : null}
                  {state.actor ? (
                    <span className="xs t3" title={state.actor.email ?? state.actor.id}>
                      {t('run.ranBy', { name: state.actor.name })}
                    </span>
                  ) : null}
                  {runsOn ? (
                    <span className="chip s-idle">
                      <Icon name="cpu" />
                      {runsOn}
                    </span>
                  ) : null}
                </Row>
                <Row wrap gap={8}>
                  {canRun ? (
                    <GateActions
                      relayId={relay.id}
                      role={selectedRole}
                      gate={selected}
                      status={state.status}
                    />
                  ) : (
                    <LinkButton
                      href={
                        verdict.ok || verdict.reasonKey.startsWith('steps.noAgent')
                          ? '/connections'
                          : '/admin'
                      }
                      size="sm"
                      icon="warned"
                    >
                      {t('steps.connect')}
                    </LinkButton>
                  )}
                  <LinkButton
                    href={`/relay/${relay.id}/gate/${selected}/console${
                      selectedRole ? `?role=${selectedRole}` : ''
                    }`}
                    size="sm"
                    icon="terminal"
                  >
                    {t('run.openConsole')}
                  </LinkButton>
                </Row>
              </div>
            }
            strip={
              selected === 'implement' ? (
                <div className="strip">
                  <span className="row" style={{ gap: '6px' }}>
                    <span className="k">{t('run.planSteps')}</span>
                    <span className="v">{state.metrics?.steps ?? t('common.none')}</span>
                  </span>
                  <span className="row" style={{ gap: '6px' }}>
                    <span className="k">{t('run.tests')}</span>
                    <span className="v ink-passed">{state.metrics?.tests ?? t('common.none')}</span>
                  </span>
                  <span className="row" style={{ gap: '6px' }}>
                    <span className="k">{t('run.guard')}</span>
                    <span className="v ink-failed">
                      {(state.guardEvents ?? []).filter((event) => event.decision === 'deny').length}{' '}
                      {t('audit.guard.deny')}
                    </span>
                  </span>
                </div>
              ) : null
            }
            prompt={
              openPrompt ? (
                <div style={{ padding: 'var(--pad-card) var(--pad-card) 0' }}>
                  <PromptCard
                    relayId={relay.id}
                    role={selectedRole}
                    gate={selected}
                    prompt={openPrompt}
                  />
                </div>
              ) : null
            }
            checks={
              <div>
                {GATES[selected].commands.length > 0 ? (
                  <div style={{ margin: 'var(--pad-card)', marginBottom: '4px' }}>
                    <CommandBlock command={GATES[selected].commands[0]} />
                  </div>
                ) : null}
                {state.status === 'blocked' && GATES[selected].requires ? (
                  <div style={{ margin: '8px var(--pad-card)' }}>
                    <Banner
                      tone="info"
                      inline
                      icon="blocked"
                      title={t('run.blocked', {
                        gate: t(`gate.${GATES[selected].requires}` as 'gate.pull'),
                      })}
                    />
                  </div>
                ) : null}
                <div className="checks">
                  {state.checks.length === 0 ? (
                    <div className="panel-b">
                      <span className="sm t3">{t('run.noChecks')}</span>
                    </div>
                  ) : (
                    state.checks.map((check) => <CheckRow key={check.id} check={check} t={t} />)
                  )}
                </div>
              </div>
            }
            console={
              <div className="stream">
                {events.length === 0 ? (
                  <span className="sm t3">{t('console.empty')}</span>
                ) : (
                  events.slice(-6).map((event) => (
                    <div className="msg" key={event.seq}>
                      <span className="who">
                        {event.body.kind === 'message' && event.body.who === 'user'
                          ? t('console.me')
                          : event.body.kind === 'message'
                            ? t('console.claude')
                            : ''}
                      </span>
                      <div className="body">
                        {event.body.kind === 'message'
                          ? event.body.text
                          : event.body.kind === 'command'
                            ? event.body.command
                            : event.body.kind === 'tool'
                              ? `${event.body.name} ${event.body.target ?? ''}`
                              : event.body.kind}
                      </div>
                    </div>
                  ))
                )}
                <LinkButton
                  href={`/relay/${relay.id}/gate/${selected}/console${
                    selectedRole ? `?role=${selectedRole}` : ''
                  }`}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {t('run.openConsole')}
                </LinkButton>
              </div>
            }
            artifacts={
              <div className="checks">
                {state.artifacts.length === 0 ? (
                  <div className="panel-b">
                    <span className="sm t3">{t('run.noArtifacts')}</span>
                  </div>
                ) : (
                  state.artifacts.map((artifact) => (
                    <div className="check s-idle" key={artifact.path}>
                      <span className="ci">
                        <Icon name="package" />
                      </span>
                      <div className="cm">
                        <span className="mono">{artifact.path}</span>
                        {artifact.summary ? <span className="loc">{artifact.summary}</span> : null}
                      </div>
                      {artifact.owner ? (
                        <span className="cs">
                          <OwnershipBadge
                            owner={artifact.owner}
                            label={
                              artifact.owner === 'researcher'
                                ? t('package.owner.researcher')
                                : t('package.owner.developer')
                            }
                          />
                        </span>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            }
            metrics={
              <div className="panel-b stack">
                <KeyValues
                  items={Object.entries(state.metrics ?? {}).map(([key, value]) => ({
                    key,
                    value: String(value),
                  }))}
                />
                {state.commands && state.commands.length > 0 ? (
                  <Stack gap={6}>
                    {state.commands.map((command, index) => (
                      <CommandBlock
                        key={index}
                        command={command.command}
                        exitCode={command.exitCode}
                      />
                    ))}
                  </Stack>
                ) : null}
                <div className="anchor">
                  <span className="t3">session anchor</span>
                  <span>
                    [WIZRELAY] Active task {relay.id} · research v{relay.version} · role{' '}
                    {activeRole} · scope mode {relay.enforcement} · open questions {openQuestions}
                  </span>
                </div>
                <p className="xs t3">{t('settings.privacyBody')}</p>
              </div>
            }
          />

          <aside className="run-ctx" aria-label={t('run.context.progress')}>
            <ContextTabs
              counts={{ questions: openQuestions }}
              scope={
                <Expand title={t('run.context.scope')}>
                <Stack gap={10}>
                  <GlobList allow={scope?.allow ?? []} deny={scope?.deny ?? []} />
                  <Stack gap={4}>
                    <Row gap={8} wrap>
                      <span className="xs t3">{t('run.context.criteria')}</span>
                      <span className="count-badge">{criteria.length}</span>
                    </Row>

                    {criteria.slice(0, 8).map((criterion) => (
                      <Row key={criterion.id} gap={8}>
                        <span className="mono xs strong">{criterion.id}</span>
                        <span className="sm">{criterion.title}</span>
                      </Row>
                    ))}
                    {criteria.length === 0 ? (
                      <span className="sm t3">{t('package.noCriteria')}</span>
                    ) : null}
                    {criteria.length > 8 ? (
                      <Link className="xs" href={`/package/${relay.id}?role=${activeRole ?? ''}`}>
                        {t('run.allCriteria', { count: criteria.length })}
                      </Link>
                    ) : null}
                  </Stack>
                </Stack>
                </Expand>
              }
              routing={
                routing ? (
                  <Stack gap={8}>
                    <Row gap={8} wrap>
                      <span className="mono strong">{routing.tier}</span>
                      <span className="xs t3">
                        {t('routing.score')} {routing.score}
                      </span>
                      <Link className="xs" href={`/relay/${relay.id}/routing?role=${activeRole}`}>
                        {t('common.open')}
                      </Link>
                    </Row>
                    <KeyValues
                      items={Object.entries(routing.phases).map(([phase, setting]) => ({
                        key: phase,
                        value: `${setting.model} / ${setting.effort}${
                          setting.advisor ? ` + ${setting.advisor}` : ''
                        }`,
                      }))}
                    />
                  </Stack>
                ) : undefined
              }
              questions={
                relay.questions.length === 0 ? (
                  <span className="sm t2">{t('questions.empty')}</span>
                ) : (
                  <Stack gap={10}>
                    {relay.questions.map((item) => (
                      <Stack gap={4} key={item.id}>
                        <div className="row spread">
                          <span className="mono strong">{item.id}</span>
                          <span className={`chip ${item.status === 'OPEN' ? 's-handoff' : 's-passed'}`}>
                            <Icon name={item.status === 'OPEN' ? 'handoff' : 'passed'} />
                            {relativeTime(item.askedAt, locale)}
                          </span>
                        </div>
                        <span className="sm">{item.title}</span>
                        {item.blocks ? (
                          <span className="xs t3">
                            {t('questions.blocks', { criterion: item.blocks })}
                            {item.decisionId ? ` · ${item.decisionId}` : ''}
                          </span>
                        ) : null}
                      </Stack>
                    ))}
                  </Stack>
                )
              }
              launch={
                routing ? (
                  <Stack gap={8}>
                    <CommandBlock command={routing.launch} />
                    <span className="xs t3">
                      {t('run.launch')} · {routing.tier}
                    </span>
                    <Row wrap gap={8}>
                      <LinkButton href={`/relay/${relay.id}/audit?role=${activeRole}`} size="sm">
                        {t('run.openAudit')}
                      </LinkButton>
                      <LinkButton href={`/relay/${relay.id}/verify?role=${activeRole}`} size="sm">
                        {t('run.openVerify')}
                      </LinkButton>
                      <LinkButton href={`/package/${relay.id}`} size="sm">
                        {t('run.openPackage')}
                      </LinkButton>
                    </Row>
                  </Stack>
                ) : undefined
              }
            />
          </aside>
        </div>
      </div>
    </>
  );
}

export type { Relay };

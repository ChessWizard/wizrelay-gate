import { notFound } from 'next/navigation';
import { DEFAULT_POLICY } from '@/core/routing/policy';
import { route } from '@/core/routing/routing';
import type { Signals } from '@/core/routing/routing';
import { loadRelay } from '@/services/relays/service';
import { getWorkspace } from '@/services/store/store';
import { createTranslator } from '@/shared/i18n/translate';
import { cn } from '@/shared/lib/cn';
import { Banner, CommandBlock, KeyValues, Panel, Row, SectionHeader, Stack } from '@/shared/ui/primitives';
import { Table, TableBox } from '@/shared/ui/data';

/**
 * S8 — routing.
 *
 * The score is shown as arithmetic, because the number on its own is not an argument. The
 * policy's source is named: a hub's own policy replaces the plugin default, and the UI
 * never pretends otherwise.
 */
export async function RoutingScreen({ relayId, role }: { relayId: string; role?: string }) {
  const relay = await loadRelay(relayId);
  if (!relay) notFound();
  const workspace = await getWorkspace();
  const t = createTranslator(workspace.locale);

  const activeRole = role && relay.roles.includes(role) ? role : relay.roles[0];

  /**
   * The signals are the package's, from `task.json`. Where a package declares none, the
   * plugin's own fallback is medium across the board — shown as such rather than as a
   * judgement nobody made.
   */
  const signals: Signals = relay.routing?.signals ?? {
    complexity: 'medium',
    risk: 'medium',
    ambiguity: 'medium',
  };
  const declared = Boolean(relay.routing?.signals);

  const byRole = relay.roles.map((candidate) => {
    const profile = workspace.repos.find((repo) => repo.role === candidate)?.profile;
    const decision = route({
      signals,
      roleSignals: relay.routing?.role_signals?.[candidate],
      role: candidate,
      taskId: relay.id,
      title: relay.title,
      scope: relay.scope[candidate],
      profile,
    });
    return { role: candidate, decision };
  });

  const active = byRole.find((item) => item.role === activeRole) ?? byRole[0];
  const decision = active.decision;

  return (
    <div className="page">
      <SectionHeader
        level={1}
        title={t('routing.title')}
        note={`${relay.id} · ${activeRole}`}
        actions={<span className="mono sm t3">{t('routing.policy.default')}</span>}
      />

      {!declared ? (
        <Banner tone="info" title={t('routing.noSignals')} body={t('routing.noSignalsHow')} />
      ) : null}

      <Panel title={t('routing.arithmetic')} aside={<span className="mono xs t3">{decision.tier}</span>}>
        <div className="math">
          <span className="term">
            {t('routing.signal.complexity')} {decision.signals.complexity} <b>({{ low: 1, medium: 2, high: 3 }[decision.signals.complexity]})</b>
          </span>
          <span className="op">+</span>
          <span className="term">
            {t('routing.signal.risk')} {decision.signals.risk} <b>({{ low: 1, medium: 2, high: 3 }[decision.signals.risk]})</b>
          </span>
          <span className="op">+</span>
          <span className="term">
            {t('routing.signal.ambiguity')} {decision.signals.ambiguity} <b>({{ low: 1, medium: 2, high: 3 }[decision.signals.ambiguity]})</b>
          </span>
          {decision.modifiers.map((modifier) => (
            <span key={modifier.key} style={{ display: 'contents' }}>
              <span className="op">+</span>
              <span className="term">
                {t(`routing.modifier.${modifier.key}` as 'routing.modifier.codebase_size_large')}{' '}
                <b>({modifier.weight})</b>
              </span>
            </span>
          ))}
          <span className="op">=</span>
          <span className="res">
            {t('routing.score')} {decision.score} → {decision.tier}
          </span>
        </div>
        <p className="sm t2" style={{ marginTop: '12px' }}>
          {t('routing.meaning')}
        </p>
      </Panel>

      <Panel title={t('routing.tiers')}>
        <div className="tiers">
          {[DEFAULT_POLICY.mechanical, ...DEFAULT_POLICY.tiers].map((tier) => (
            <div className={cn('tier', tier.name === decision.tier && 'is-on')} key={tier.name}>
              <span className="tn mono">{tier.name}</span>
              <span className="tr">
                {'max_score' in tier ? `≤ ${tier.max_score}` : 'kind: mechanical'}
              </span>
              <span className="xs t3">
                {tier.phases.implement.model} / {tier.phases.implement.effort}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={t('routing.phases')}>
        <TableBox>
          <Table
            label={t('routing.phases')}
            head={
              <tr>
                <th>{t('routing.phase')}</th>
                <th>{t('routing.model')}</th>
                <th>{t('routing.effort')}</th>
                <th>{t('routing.advisor')}</th>
              </tr>
            }
          >
            {Object.entries(decision.phases).map(([phase, setting]) => (
              <tr key={phase}>
                <td>{phase}</td>
                <td className="mono">{setting.model}</td>
                <td className="mono">{setting.effort}</td>
                <td className="mono">{setting.advisor ?? t('common.none')}</td>
              </tr>
            ))}
          </Table>
        </TableBox>
      </Panel>

      <Panel title={t('routing.launch')}>
        <CommandBlock command={decision.launch} />
      </Panel>

      {byRole.length > 1 ? (
        <Panel title={t('routing.roleCompare')}>
          <Row wrap gap={16}>
            {byRole.map((item) => (
              <Stack gap={6} key={item.role}>
                <span className="strong mono">{item.role}</span>
                <KeyValues
                  items={[
                    { key: t('routing.tier'), value: item.decision.tier },
                    { key: t('routing.score'), value: String(item.decision.score) },
                    {
                      key: 'implement',
                      value: `${item.decision.phases.implement.model} / ${item.decision.phases.implement.effort}`,
                    },
                  ]}
                />
              </Stack>
            ))}
          </Row>
        </Panel>
      ) : null}
    </div>
  );
}

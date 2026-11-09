import Link from 'next/link';
import type { GateState, RelaySummary } from '@/core/relay/types';
import { hasWorkInFlight } from '@/core/relay/derive';
import { relativeTime } from '@/core/time/format';
import type { Locale } from '@/shared/i18n/config';
import type { Translator } from '@/shared/i18n/translate';
import { VersionChip } from '@/shared/ui/primitives';
import { StatusChip } from '@/shared/ui/status';
import { TrackBadges } from '@/shared/ui/track-badges';
import { Flow, FlowProgress, type FlowStage } from '@/features/pipeline/components/flow';

/**
 * One relay on the board.
 *
 * The earlier row printed every gate's name, status and duration as a line of pills — nine
 * labels per role, which read as noise once there were more than two relays. This shows
 * the same nine gates as a flow of dots, the title, and one status; the words are in the
 * gate's console, one click away, where someone who needs them is already going.
 */
function stagesOf(
  states: GateState[],
  href: string,
  role: string | undefined,
): FlowStage[] {
  return states.map((state) => ({
    gate: state.gate,
    status: state.status,
    durationMs: state.durationMs,
    href: `${href}?${role ? `role=${role}&` : ''}gate=${state.gate}`,
  }));
}

export function RelayCard({
  relay,
  t,
  locale,
}: {
  relay: RelaySummary;
  t: Translator;
  locale: Locale;
}) {
  const href = `/relay/${relay.id}`;
  const ahead = relay.hubVersion !== undefined && relay.hubVersion > relay.version;

  const live = hasWorkInFlight(
    [...relay.research, ...relay.byRole.flatMap((role) => role.gates)],
    relay.updatedAt,
  );

  const allStates = [...relay.research, ...relay.byRole.flatMap((role) => role.gates)];

  return (
    <article className="relay">
      <div className="relay-info stack" style={{ gap: '4px', minWidth: 0 }}>
        <div className="row wrap" style={{ gap: '6px' }}>
          <Link className="rid" href={href}>
            {relay.id}
          </Link>
          <VersionChip ahead={ahead}>
            {ahead ? `v${relay.version} → v${relay.hubVersion}` : `v${relay.version}`}
          </VersionChip>
          {relay.localOnly ? <span className="chip s-idle">{t('board.localOnly')}</span> : null}
        </div>
        <Link className="rtitle" href={href} style={{ textWrap: 'pretty' }}>
          {relay.title}
        </Link>
        <FlowProgress stages={allStates} current={relay.currentGate} t={t} />
      </div>

      <div className="relay-flows stack" style={{ gap: 'var(--space-2)', minWidth: 0 }}>
        <div className="relay-track">
          <div className="track-id is-sm">
            <span className="track-name">{t('track.research')}</span>
          </div>
          <Flow stages={stagesOf(relay.research, href, undefined)} t={t} locale={locale} size="sm" />
        </div>
        {relay.byRole.map((role) => (
          <div className="relay-track" key={role.role}>
            <div className="track-id is-sm">
              <span className="track-name">{t('track.delivery')}</span>
              <TrackBadges role={role.role} repo={role.repo} t={t} />
            </div>
            <Flow stages={stagesOf(role.gates, href, role.role)} t={t} locale={locale} size="sm" />
          </div>
        ))}
      </div>

      <div className="rmeta">
        <StatusChip status={relay.status} t={t} />
        <span className="num xs" title={relay.updatedAt}>
          {relativeTime(relay.updatedAt, locale)}
        </span>
        {live ? (
          <span className="live-tag">
            <span className="live-dot" aria-hidden="true" />
            {t('flow.live')}
          </span>
        ) : null}
      </div>
    </article>
  );
}

import Link from 'next/link';
import type { GateId } from '@/core/gates/gates';
import { GATE_IDS } from '@/core/gates/gates';
import type { GateState } from '@/core/relay/types';
import type { GateStatus } from '@/core/status/status';
import { isActive, isTerminal, statusClass } from '@/core/status/status';
import { formatDuration } from '@/core/time/format';
import type { Locale } from '@/shared/i18n/config';
import type { Translator } from '@/shared/i18n/translate';
import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/icons';
import { STATUS_ICON } from '@/shared/ui/status';

/**
 * The pipeline, drawn the way a build pipeline is drawn: a line of stages, the finished
 * ones solid, the live one moving, the rest waiting their turn.
 *
 * It carries one word per stage and nothing else. Everything a stage knows — its result,
 * its checks, its transcript — is one click away in its console, so the board does not
 * have to say it twice. The motion is CSS only: a connector animates because the stage
 * after it is live, which the server already knows, so no timer runs in the browser to
 * keep it moving.
 */

export interface FlowStage {
  gate: GateId;
  status: GateStatus;
  durationMs?: number;
  href: string;
  selected?: boolean;
  /** The gate's one-line result, kept as the node's tooltip rather than printed. */
  result?: string;
}

/** A connector is live when work has reached it but not yet left it. */
function linkState(left: FlowStage, right: FlowStage): 'done' | 'live' | 'idle' {
  if (isTerminal(left.status) && isActive(right.status)) return 'live';
  if (isTerminal(left.status) && isTerminal(right.status)) return 'done';
  if (isTerminal(left.status)) return 'done';
  return 'idle';
}

export function FlowNode({
  stage,
  t,
  locale,
  size = 'default',
}: {
  stage: FlowStage;
  t: Translator;
  locale: Locale;
  size?: 'sm' | 'default';
}) {
  const label = t(`gate.${stage.gate}` as 'gate.pull');
  const status = t(`status.${stage.status}` as 'status.idle');
  const live = isActive(stage.status);

  return (
    <Link
      className={cn(
        'fnode',
        statusClass(stage.status),
        size === 'sm' && 'fnode-sm',
        live && 'is-live',
        stage.selected && 'is-selected',
      )}
      href={stage.href}
      title={[label, status, stage.result].filter(Boolean).join(' · ')}
    >
      <span className="fdot">
        <Icon name={STATUS_ICON[stage.status]} />
        {live ? <span className="fring" aria-hidden="true" /> : null}
      </span>
      <span className="flabel">{label}</span>
      <span className="sr">{status}</span>
      {stage.durationMs && isTerminal(stage.status) ? (
        <span className="fmeta mono" title={t('run.tookHelp')}>
          {formatDuration(stage.durationMs, locale)}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * One rail of stages with animated connectors. `label` names the track; it is shown once,
 * on the left, rather than repeated on every stage.
 */
export function Flow({
  stages,
  t,
  locale,
  label,
  size = 'default',
}: {
  stages: FlowStage[];
  t: Translator;
  locale: Locale;
  label?: string;
  size?: 'sm' | 'default';
}) {
  if (stages.length === 0) return null;

  return (
    <div className={cn('flow', size === 'sm' && 'flow-sm')}>
      {label ? <span className="flow-label">{label}</span> : null}
      <div className="flow-rail">
        {stages.map((stage, index) => (
          <span key={stage.gate} className="flow-cell">
            {index > 0 ? (
              <span
                className={cn('flow-link', `is-${linkState(stages[index - 1], stage)}`)}
                aria-hidden="true"
              />
            ) : null}
            <FlowNode stage={stage} t={t} locale={locale} size={size} />
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * How far along the whole relay is: "stage 6 of 9", with the bar filled by the stages that
 * have finished. It replaces the metric tiles people had to read and add up themselves.
 */
export function FlowProgress({
  stages,
  current,
  t,
}: {
  stages: GateState[];
  current: GateId;
  t: Translator;
}) {
  const total = stages.length || GATE_IDS.length;
  const done = stages.filter((state) => isTerminal(state.status)).length;
  const index = Math.max(
    1,
    stages.findIndex((state) => state.gate === current) + 1 || done + 1,
  );
  const percent = Math.round((done / total) * 100);

  return (
    <div className="fprog" title={`${percent}%`}>
      <span className="fprog-text">
        {t('flow.progress', { index, total, gate: t(`gate.${current}` as 'gate.pull') })}
      </span>
      <span className="fprog-bar" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </span>
    </div>
  );
}

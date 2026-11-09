import Link from 'next/link';
import type { GateId } from '@/core/gates/gates';
import type { GateStatus } from '@/core/status/status';
import { statusClass } from '@/core/status/status';
import type { Translator } from '@/shared/i18n/translate';
import { translateDynamic } from '@/shared/i18n/translate';
import { cn } from '@/shared/lib/cn';
import { Icon } from './icons';
import type { IconName } from './icons';

const STATUS_ICON: Record<GateStatus, IconName> = {
  idle: 'idle',
  running: 'running',
  waiting: 'waiting',
  handoff: 'handoff',
  passed: 'passed',
  warned: 'warned',
  failed: 'failed',
  blocked: 'blocked',
  skipped: 'skipped',
};

export function statusLabel(status: GateStatus, t: Translator): string {
  return t(`status.${status}` as 'status.idle');
}

/** A gate's one-line result, whether it came as prose or as a catalogue key. */
export function gateResult(
  state: { result?: string; resultKey?: string; resultParams?: Record<string, string | number> },
  t: Translator,
): string | undefined {
  return state.result ?? translateDynamic(t, state.resultKey, state.resultParams);
}

export function StatusChip({
  status,
  t,
  size = 'compact',
  className,
}: {
  status: GateStatus;
  t: Translator;
  size?: 'compact' | 'full';
  className?: string;
}) {
  return (
    <span className={cn('chip', statusClass(status), size === 'full' && 'chip-lg', className)}>
      <Icon name={STATUS_ICON[status]} />
      {statusLabel(status, t)}
    </span>
  );
}

/** The board's gate element: name, status and how long it took. */
export function GatePill({
  gate,
  status,
  t,
  duration,
  href,
}: {
  gate: GateId;
  status: GateStatus;
  t: Translator;
  duration?: string;
  href?: string;
}) {
  const label = statusLabel(status, t);
  const name = t(`gate.${gate}` as 'gate.pull');
  const content = (
    <>
      <Icon name={STATUS_ICON[status]} />
      <span className="pn">{name}</span>
      <span className="sr">{label}</span>
      {duration ? <span className="pd">{duration}</span> : null}
    </>
  );
  const title = `GATE.${gate.toUpperCase()} · ${label}`;
  if (href) {
    return (
      <Link className={cn('pill', statusClass(status))} href={href} title={title}>
        {content}
      </Link>
    );
  }
  return (
    <span className={cn('pill', statusClass(status))} title={title}>
      {content}
    </span>
  );
}

export { STATUS_ICON };

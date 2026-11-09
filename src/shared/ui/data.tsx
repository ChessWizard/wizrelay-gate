import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Check, Finding } from '@/core/relay/types';
import type { Translator } from '@/shared/i18n/translate';
import { cn } from '@/shared/lib/cn';
import { Icon } from './icons';

const CHECK_ICON = { pass: 'passed', fail: 'failed', skip: 'skipped' } as const;
const CHECK_CLASS = { pass: 's-passed', fail: 's-failed', skip: 's-skipped' } as const;

/** One deterministic assertion, with the place or command that produced it. */
export function CheckRow({ check, t }: { check: Check; t: Translator }) {
  const label =
    check.status === 'pass' ? t('check.pass') : check.status === 'fail' ? t('check.fail') : t('check.skip');
  return (
    <div className={cn('check', check.status === 'fail' && 'is-fail')}>
      <span className={cn('ci', CHECK_CLASS[check.status])}>
        <Icon name={CHECK_ICON[check.status]} />
      </span>
      <div className="cm">
        <span>{check.message}</span>
        {check.loc ? <span className="loc mono">{check.loc}</span> : null}
        {check.command ? (
          <div className="cmd">
            <span className="p">$</span>
            <code>{check.command}</code>
          </div>
        ) : null}
        {check.output ? <div className="out">{check.output}</div> : null}
      </div>
      <span className="cs mono">{label}</span>
    </div>
  );
}

export function FindingRow({
  finding,
  t,
  action,
}: {
  finding: Finding;
  t: Translator;
  action?: ReactNode;
}) {
  return (
    <div className={cn('check', finding.severity === 'blocking' && 'is-fail')}>
      <span className={cn('ci', finding.severity === 'blocking' ? 's-failed' : 's-warned')}>
        <Icon name={finding.severity === 'blocking' ? 'failed' : 'warned'} />
      </span>
      <div className="cm">
        <span>{finding.message}</span>
        <span className="row wrap" style={{ gap: '6px' }}>
          {finding.loc ? <span className="loc mono">{finding.loc}</span> : null}
          <span className="xs t3">
            {finding.source === 'critic' ? t('validate.source.critic') : t('validate.source.validate')}
          </span>
        </span>
      </div>
      {action ? <span className="cs">{action}</span> : null}
    </div>
  );
}

export function MetricTile({
  label,
  value,
  sub,
  loud,
  split,
  busy,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  loud?: boolean;
  split?: { pass: number; partial: number; fail: number; label: string };
  busy?: boolean;
}) {
  return (
    <div className={cn('tile', loud && 'is-loud')} aria-busy={busy ? 'true' : 'false'}>
      <span className="tl">{label}</span>
      <span className="tv">{value}</span>
      {split ? (
        <div className="split" aria-label={split.label}>
          <span style={{ flex: Math.max(split.pass, 0.001), background: 'var(--status-passed-fg)' }} />
          <span style={{ flex: Math.max(split.partial, 0.001), background: 'var(--status-warned-fg)' }} />
          <span style={{ flex: Math.max(split.fail, 0.001), background: 'var(--status-failed-fg)' }} />
        </div>
      ) : null}
      {sub ? <span className="td">{sub}</span> : null}
    </div>
  );
}

export function TableBox({ children }: { children: ReactNode }) {
  return <div className="tbl-box">{children}</div>;
}

export function Table({
  head,
  children,
  label,
}: {
  head: ReactNode;
  children: ReactNode;
  label?: string;
}) {
  return (
    <table className="tbl" aria-label={label}>
      <thead>{head}</thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function DiffView({
  file,
  note,
  lines,
}: {
  file: string;
  note?: string;
  lines: { sign: '+' | '-' | ' '; line: number; text: string }[];
}) {
  return (
    <div className="diff">
      <div className="diff-h">
        <span className="mono">{file}</span>
        {note ? <span className="t3">{note}</span> : null}
      </div>
      {lines.map((line, index) => (
        <div
          key={index}
          className={cn('dl', line.sign === '+' && 'add', line.sign === '-' && 'rem')}
        >
          <span className="ln">{line.line}</span>
          <span className="sg">{line.sign === ' ' ? '' : line.sign}</span>
          <span className="tx">{line.text}</span>
        </div>
      ))}
    </div>
  );
}

export function TreeLink({
  href,
  active,
  children,
  badge,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <Link href={href} className={cn(active && 'is-on')}>
      <span className="grow">{children}</span>
      {badge}
    </Link>
  );
}

export function Timeline({
  events,
}: {
  events: { at: ReactNode; title: ReactNode; detail?: ReactNode; tone?: 'deny' | 'ask' }[];
}) {
  return (
    <div className="stack" style={{ gap: '8px' }}>
      {events.map((event, index) => (
        <div key={index} className="tl-ev">
          <span className={cn('chip', event.tone === 'deny' ? 's-failed' : 's-waiting')}>
            <Icon name={event.tone === 'deny' ? 'shield' : 'waiting'} />
            {event.tone === 'deny' ? 'deny' : 'ask'}
          </span>
          <div className="grow stack" style={{ gap: '2px' }}>
            <span className="sm">{event.title}</span>
            {event.detail ? <span className="xs t3">{event.detail}</span> : null}
          </div>
          <span className="xs t3 mono">{event.at}</span>
        </div>
      ))}
    </div>
  );
}

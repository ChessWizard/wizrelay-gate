'use client';

import type { GateEvent } from '@/core/relay/events';
import { useTranslator } from '@/shared/i18n/provider';
import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/icons';
import { DiffView } from '@/shared/ui/data';
import { Disclosure } from '@/shared/ui/controls';
import { Markdown } from '@/shared/ui/markdown';

/**
 * One line of the console. Tool calls collapse to a line; output keeps its exit code.
 *
 * `grouped` is set when the line before this one was the same speaker, so a turn of five
 * messages reads as one turn rather than as five stamped envelopes.
 */
export function ConsoleMessage({
  event,
  showTools,
  grouped,
}: {
  event: GateEvent;
  showTools: boolean;
  grouped?: boolean;
}) {
  const t = useTranslator();
  const body = event.body;

  if (body.kind === 'message') {
    const mine = body.who === 'user';
    return (
      <div className={cn('msg', 'turn', mine && 'user', grouped && 'is-grouped')}>
        <span className="who" aria-hidden={grouped || undefined}>
          {grouped ? '' : mine ? t('console.me') : t('console.claude')}
        </span>
        <div className="turn-col">
          {grouped ? null : (
            <span className="turn-name">{mine ? t('console.nameMe') : t('console.nameClaude')}</span>
          )}

          <div className="body">
            {mine ? body.text : <Markdown source={body.text} className="md-console" />}
          </div>
        </div>
      </div>
    );
  }

  if (body.kind === 'thinking') {
    return (
      <div className="msg">
        <span className="who" />
        <Disclosure summary={`${t('console.thinking')} · ${body.text.length} chars`}>
          <div className="out">{body.text}</div>
        </Disclosure>
      </div>
    );
  }

  if (body.kind === 'tool') {
    if (!showTools) return null;
    const failed = body.result === 'denied';
    return (
      <div className="msg">
        <span className="who" />
        <span className="tool">
          <Icon name="terminal" />
          <span className="tn">{body.name}</span>
          <span className="tt">{body.target}</span>
          {body.result ? (
            <span className={failed ? 'ink-failed' : body.result === 'asked' ? 'ink-waiting' : 'ink-passed'}>
              {body.result}
            </span>
          ) : null}
        </span>
      </div>
    );
  }

  if (body.kind === 'command') {
    return (
      <div className="msg">
        <span className="who" />
        <div className="stack" style={{ gap: '4px' }}>
          <div className="cmd">
            <span className="p">$</span>
            <code>{body.command}</code>
            {body.exitCode !== undefined ? (
              <span className={cn('exit chip', body.exitCode === 0 ? 's-passed' : 's-failed')}>
                exit {body.exitCode}
              </span>
            ) : null}
          </div>
          {body.output ? <div className="out">{body.output}</div> : null}
        </div>
      </div>
    );
  }

  if (body.kind === 'diff') {
    if (!showTools) return null;
    return (
      <div className="msg">
        <span className="who" />
        <DiffView file={body.file} note={t('console.proposed')} lines={body.lines} />
      </div>
    );
  }

  if (body.kind === 'guard') {
    const deny = body.event.decision === 'deny';
    return (
      <div className="msg">
        <span className="who" />
        <div className={cn('banner inline', deny ? 'b-error' : 'b-warn')} role="note">
          <Icon name="shield" className="bi" />
          <div className="grow stack" style={{ gap: '4px' }}>
            <span className="bt">{deny ? t('console.denyTitle') : t('prompt.scope')}</span>
            <span className="sm">
              <span className="mono">{body.event.file}</span>
              {body.event.pattern ? (
                <>
                  {' · '}
                  {t('audit.matched', { pattern: body.event.pattern })}
                </>
              ) : null}
            </span>
            {deny ? <span className="sm t2">{t('console.denyWay')}</span> : null}
          </div>
        </div>
      </div>
    );
  }

  if (body.kind === 'check') {
    return (
      <div className="msg">
        <span className="who" />
        <span
          className={cn(
            'chip',
            body.check.status === 'pass' ? 's-passed' : body.check.status === 'fail' ? 's-failed' : 's-skipped',
          )}
        >
          <Icon
            name={body.check.status === 'pass' ? 'passed' : body.check.status === 'fail' ? 'failed' : 'skipped'}
          />
          {body.check.message}
        </span>
      </div>
    );
  }

  if (body.kind === 'artifact') {
    return (
      <div className="msg">
        <span className="who" />
        <span className="row" style={{ gap: '8px' }}>
          <Icon name="package" />
          <span className="mono sm">{body.artifact.path}</span>
          <span className="xs t3">{body.artifact.summary}</span>
        </span>
      </div>
    );
  }

  if (body.kind === 'machine') {
    return (
      <div className="msg">
        <span className="who" />
        <span className="chip s-idle">
          <Icon name="cpu" />
          {t('agent.ranOn', { machine: body.machine })}
        </span>
      </div>
    );
  }

  if (body.kind === 'approval-skipped') {
    return (
      <div className="msg">
        <span className="who" />
        <span className="chip s-warned">
          <Icon name="warned" />
          {t('approval.ranWithout', { command: body.command })}
        </span>
      </div>
    );
  }

  if (body.kind === 'error') {
    const warn = body.tone === 'warn';
    return (
      <div className="msg">
        <span className="who" />
        <div className={cn('banner inline', warn ? 'b-warn' : 'b-error')} role="note">
          <Icon name={warn ? 'warned' : 'failed'} className="bi" />
          <span className="sm grow">{body.message}</span>
        </div>
      </div>
    );
  }

  if (body.kind === 'done') {
    return (
      <div className="msg">
        <span className="who" />
        <span
          className={cn(
            'chip chip-lg',
            body.verdict === 'PASS' ? 's-passed' : body.verdict === 'PARTIAL' ? 's-warned' : 's-failed',
          )}
        >
          <Icon name={body.verdict === 'PASS' ? 'passed' : body.verdict === 'PARTIAL' ? 'warned' : 'failed'} />
          {t(`verdict.${body.verdict}` as 'verdict.PASS')} · {body.summary}
        </span>
      </div>
    );
  }

  return null;
}

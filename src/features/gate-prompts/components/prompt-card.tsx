'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { GateId } from '@/core/gates/gates';
import type { GatePrompt } from '@/core/relay/types';
import { absoluteTime, relativeTime } from '@/core/time/format';
import { useLocale, useTranslator } from '@/shared/i18n/provider';
import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/icons';
import { Button, GlobChip, Row } from '@/shared/ui/primitives';
import { StopAsking } from './stop-asking';
import { CopyButton } from '@/shared/ui/controls';
import { submitAnswer } from '../actions';

export interface PromptCardProps {
  relayId: string;
  role?: string;
  gate: GateId;
  prompt: GatePrompt;
  /** The pinned copy at the bottom of the console. */
  pinned?: boolean;
  /** Where the prompt was asked, for the "jump to" link in the pinned copy. */
  anchor?: string;
}

/**
 * A gate prompt.
 *
 * Five variants, one contract: it names its gate, asks one sentence, says what each
 * answer causes, and pre-selects nothing. An outward-facing approval shows the whole
 * payload and needs the confirm word typed — and always offers to hand the command back
 * so the person can run it themselves.
 */
export function PromptCard({ relayId, role, gate, prompt, pinned, anchor }: PromptCardProps) {
  const t = useTranslator();
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  const [choice, setChoice] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const answered = prompt.status === 'answered';
  const stale = prompt.status === 'stale';
  const confirmWord = prompt.payload?.confirmWord;
  /**
   * Which outward-facing step this is, read from the command the prompt is showing. Only
   * a commit or a push can be switched off; nothing else here leaves the machine.
   */
  const command = prompt.payload?.command ?? '';
  const approvalKind: 'commit' | 'push' | null = /\bgit\s+push\b/.test(command)
    ? 'push'
    : /\bgit\s+commit\b/.test(command)
      ? 'commit'
      : null;

  const answer = (optionId?: string, value?: string) =>
    start(async () => {
      const result = await submitAnswer({
        relayId,
        role,
        gate,
        promptId: prompt.id,
        optionId,
        text: value,
      });
      if (!result.ok) {
        setError(result.reason ?? 'error');
        return;
      }
      setError(null);
      router.refresh();
    });

  const header = (
    <div className="prompt-h">
      <span className={cn('chip', answered ? 's-passed' : stale ? 's-skipped' : 's-waiting')}>
        <Icon name={answered ? 'passed' : stale ? 'skipped' : 'waiting'} />
        {answered ? t('prompt.answered') : stale ? t('prompt.stale') : t('status.waiting')}
      </span>
      <span className="strong">{t(`prompt.${prompt.variant}` as 'prompt.decision')}</span>
      <span className="t3">
        GATE.{gate.toUpperCase()} ·{' '}
        <span title={absoluteTime(prompt.askedAt, locale)}>
          {t('common.ago', { age: relativeTime(prompt.askedAt, locale) })}
        </span>
        {prompt.payload?.step
          ? ` · ${t('prompt.step', {
              index: prompt.payload.step.index,
              total: prompt.payload.step.total,
            })}`
          : ''}
        {pinned ? ` · ${t('prompt.pinned')}` : ''}
      </span>
      {pinned && anchor ? (
        <>
          <span className="grow" />
          <a className="xs" href={anchor}>
            {t('prompt.jumpToAsked')}
          </a>
        </>
      ) : null}
    </div>
  );

  return (
    <div
      className={cn('prompt', answered && 'is-answered', stale && 'is-stale', pinned && 'is-pinned')}
      role={pinned ? 'alertdialog' : 'region'}
      aria-label={`${t(`prompt.${prompt.variant}` as 'prompt.decision')}: ${prompt.question}`}
      id={pinned ? 'pinned' : undefined}
    >
      {header}

      <div className="prompt-b">
        <div className="prompt-q">{prompt.question}</div>
        {prompt.detail ? <p className="sm t2">{prompt.detail}</p> : null}

        {prompt.scope ? (
          <>
            <Row wrap gap={6}>
              <span className="xs t3">{t('prompt.inScope')}</span>
              {prompt.scope.allow.map((pattern) => (
                <GlobChip key={pattern} pattern={pattern} kind="allow" />
              ))}
            </Row>
            {prompt.scope.deny && prompt.scope.deny.length > 0 ? (
              <Row wrap gap={6}>
                <span className="xs t3">{t('prompt.denied')}</span>
                {prompt.scope.deny.map((pattern) => (
                  <GlobChip key={pattern} pattern={pattern} kind="deny" />
                ))}
              </Row>
            ) : null}
          </>
        ) : null}

        {prompt.payload?.command || prompt.payload?.text ? (
          <div className="payload">
            <div className="payload-h">
              <span>{prompt.payload.command ? t('prompt.exactCommand') : t('verify.trackerPreview')}</span>
              <span className="grow" />
              {prompt.payload.target ? <span className="mono xs">{prompt.payload.target}</span> : null}
              <span className="chip s-warned">
                <Icon name="external" />
                {t('prompt.outward')}
              </span>
            </div>
            <pre>{prompt.payload.command ?? prompt.payload.text}</pre>
            {prompt.payload.command && prompt.payload.text ? (
              <div className="payload-h" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <span>{t('prompt.files')}</span>
                <span className="grow" />
                <span className="mono xs">{prompt.payload.text}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {prompt.variant === 'decision' && prompt.options ? (
          <div className="stack" style={{ gap: '8px' }}>
            <span className="xs t3">{t('prompt.options')}</span>
            {prompt.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cn('opt', choice === option.id && 'is-on')}
                aria-pressed={choice === option.id}
                disabled={answered || stale}
                onClick={() => setChoice(option.id)}
              >
                <span className="radio" />
                <span>
                  <span className="ot">{option.label}</span>
                  {option.meaning ? (
                    <span className="oc" style={{ display: 'block' }}>
                      {option.meaning}
                    </span>
                  ) : null}
                  {option.cost ? (
                    <span className="oc t3" style={{ display: 'block' }}>
                      {option.cost}
                    </span>
                  ) : null}
                </span>
                {option.handoff ? <span className="ow chip s-handoff">{t('lane.handoff')}</span> : null}
              </button>
            ))}
            {!answered ? <span className="xs t3">{t('prompt.nothingPreSelected')}</span> : null}
          </div>
        ) : null}

        {prompt.variant === 'input' ? (
          <div className="field">
            <label htmlFor={`prompt-${prompt.id}`}>{t('prompt.inputLabel')}</label>
            <textarea
              id={`prompt-${prompt.id}`}
              className="textarea"
              rows={2}
              value={text}
              disabled={answered || stale}
              onChange={(event) => setText(event.target.value)}
            />
            {prompt.destination ? (
              <span className="help">
                {t('prompt.landsIn')}: <span className="mono">{prompt.destination}</span>
              </span>
            ) : null}
          </div>
        ) : null}

        {prompt.variant === 'attachment' ? (
          <div className="drop">
            <Icon name="upload" size={20} />
            <span className="sm">{t('prompt.drop')}</span>
            <span className="xs t3">{t('prompt.limits')}</span>
          </div>
        ) : null}

        {confirmWord && !answered ? (
          <div className="confirm">
            <label className="xs t3" htmlFor={`confirm-${prompt.id}`}>
              {t('prompt.typeToConfirm', { word: confirmWord })}
            </label>
            <input
              id={`confirm-${prompt.id}`}
              className="input mono"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="off"
            />
          </div>
        ) : null}

        {answered ? (
          <span className="xs t3">
            {t('prompt.answeredBy', {
              time: prompt.answeredAt ? absoluteTime(prompt.answeredAt, locale) : '',
            })}
            {prompt.answer?.optionId ? ` · ${prompt.answer.optionId}` : ''}
          </span>
        ) : null}

        {error ? <span className="help err">{error}</span> : null}
      </div>

      {!answered && !stale ? (
        <div className="prompt-f">
          {prompt.variant === 'scope' ? (
            <>
              <Button
                disabled={pending}
                onClick={() => answer('allow-once')}
              >
                {t('prompt.allowOnce')}
              </Button>
              <Button disabled={pending} onClick={() => answer('refuse')}>
                {t('prompt.refuse')}
              </Button>
              <Button disabled={pending} onClick={() => answer('handoff')}>
                {t('prompt.askResearcher')}
              </Button>
            </>
          ) : null}

          {prompt.variant === 'decision' ? (
            <Button
              variant="primary"
              disabled={pending || choice === null}
              onClick={() => answer(choice ?? undefined)}
            >
              {t('prompt.answer')}
            </Button>
          ) : null}

          {prompt.variant === 'input' ? (
            <Button
              variant="primary"
              disabled={pending || text.trim() === ''}
              onClick={() => answer(prompt.options?.[0]?.id ?? 'submit', text)}
            >
              {t('prompt.useLine')}
            </Button>
          ) : null}

          {prompt.variant === 'approval' ? (
            <>
              <Button
                variant="primary"
                disabled={pending || (confirmWord ? confirm.trim() !== confirmWord : false)}
                onClick={() => answer(prompt.options?.[0]?.id ?? 'approve')}
              >
                {prompt.options?.[0]?.label ?? t('prompt.approval')}
              </Button>
              {prompt.payload?.command ? (
                <CopyButton
                  value={prompt.payload.command}
                  label={t('prompt.copyInstead')}
                  copiedLabel={t('prompt.copied')}
                  size="default"
                />
              ) : null}
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => answer(prompt.options?.[1]?.id ?? 'later')}
              >
                {t('prompt.notNow')}
              </Button>

              {approvalKind ? <StopAsking relayId={relayId} kindOf={approvalKind} /> : null}
            </>
          ) : null}

          {prompt.variant === 'attachment' ? (
            <>
              <Button variant="primary" disabled={pending} onClick={() => answer('attach')}>
                {t('prompt.browse')}
              </Button>
              <Button variant="ghost" disabled={pending} onClick={() => answer('skip')}>
                {t('prompt.continueWithout')}
              </Button>
            </>
          ) : null}

          {prompt.options && prompt.variant !== 'decision' && prompt.variant !== 'scope' ? (
            <span className="xs t3 grow" style={{ minWidth: '240px' }}>
              {prompt.options
                .filter((option) => option.meaning)
                .map((option) => `${option.label}: ${option.meaning}`)
                .join(' · ')}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

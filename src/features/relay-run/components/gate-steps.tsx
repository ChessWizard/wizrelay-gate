'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { GateStep } from '@/core/gates/steps';
import type { Check } from '@/core/relay/types';
import { useTranslator } from '@/shared/i18n/provider';
import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/icons';
import { Button, CommandBlock } from '@/shared/ui/primitives';
import { runReasonKey } from '@/shared/ui/run-reason';
import { runGate } from '@/features/gate-prompts/actions';

const STATUS_ICON = { pass: 'passed', fail: 'failed', skip: 'skipped' } as const;
const STATUS_CLASS = { pass: 's-passed', fail: 's-failed', skip: 's-skipped' } as const;

/**
 * What this gate will run, and what happened when it did.
 *
 * The commands here are the real ones with this relay's values already in them, which is
 * the point: a gate that says `wizrelay pull <ref>` is documentation, and one that says
 * `wizrelay pull CU-86c1abcd` is a thing you can press. Each step runs on its own, so a
 * step that failed can be retried without replaying the ones that worked.
 */
export function GateSteps({
  relayId,
  role,
  gate,
  steps,
  checks,
  canRun,
  blockedReason,
}: {
  relayId: string;
  role?: string;
  gate: string;
  steps: GateStep[];
  /** The checks the last run recorded, keyed by step id. */
  checks: Check[];
  canRun: boolean;
  blockedReason?: string;
}) {
  const t = useTranslator();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [refused, setRefused] = useState<string | null>(null);

  if (steps.length === 0) {
    return (
      <div className="panel-b">
        <span className="sm t3">{t('steps.none')}</span>
      </div>
    );
  }

  return (
    <div className="steps-list">
      {steps.map((step, index) => {
        const check = checks.find((candidate) => candidate.id === step.id);
        const tone = check ? STATUS_CLASS[check.status] : 's-idle';

        return (
          <div className={cn('step-row', tone)} key={step.id}>
            <span className="step-dot">
              {check ? <Icon name={STATUS_ICON[check.status]} /> : <span className="step-n">{index + 1}</span>}
            </span>

            <div className="stack" style={{ gap: '4px', minWidth: 0 }}>
              <div className="row wrap" style={{ gap: '8px' }}>
                <span className="sm strong">{t(step.labelKey as 'step.pull.download')}</span>
                {step.kind === 'conversation' ? (
                  <span className="chip s-handoff">
                    <Icon name="handoff" />
                    {t('steps.conversation')}
                  </span>
                ) : null}
                {step.approval ? (
                  <span className="chip s-waiting">
                    <Icon name="waiting" />
                    {t(`steps.approval.${step.approval}` as 'steps.approval.push')}
                  </span>
                ) : null}
                {step.needs ? (
                  <span className="chip s-waiting">
                    <Icon name="questions" />
                    {t(`steps.needs.${step.needs}` as 'steps.needs.summary')}
                  </span>
                ) : null}
                {step.readOnly ? <span className="xs t3">{t('steps.readOnly')}</span> : null}
                <span className="xs t3 mono">{t(`steps.where.${step.where}` as 'steps.where.hub')}</span>
              </div>

              {step.command ? <CommandBlock command={step.command} exitCode={undefined} /> : null}
              {check?.output ? <div className="out">{check.output}</div> : null}
            </div>

            {step.kind === 'command' ? (
              <div className="stack" style={{ gap: '4px', alignItems: 'flex-end' }}>
                <Button
                  size="sm"
                  variant="ghost"
                  icon="play"
                  disabled={pending || !canRun}
                  title={canRun ? undefined : blockedReason}
                  onClick={() =>
                    start(async () => {
                      const result = await runGate({ relayId, role, gate: gate as 'pull', only: step.id });
                      setRefused(result.started ? null : runReasonKey(result.reason));
                      router.refresh();
                    })
                  }
                >
                  {check ? t('steps.rerun') : t('steps.run')}
                </Button>
                {refused ? (
                  <span className="xs ink-warned">{t(refused as 'run.failed.unknown')}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

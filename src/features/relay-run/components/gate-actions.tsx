'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { GateId } from '@/core/gates/gates';
import type { GateStatus } from '@/core/status/status';
import { useTranslator } from '@/shared/i18n/provider';
import { Button, Row } from '@/shared/ui/primitives';
import { runReasonKey } from '@/shared/ui/run-reason';
import { haltGate, runGate } from '@/features/gate-prompts/actions';

/** Start, re-run or stop a gate. The only thing the dashboard itself decides is when. */
export function GateActions({
  relayId,
  role,
  gate,
  status,
}: {
  relayId: string;
  role?: string;
  gate: GateId;
  status: GateStatus;
}) {
  const t = useTranslator();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [refused, setRefused] = useState<string | null>(null);

  const running = status === 'running';
  const finished = status === 'passed' || status === 'warned' || status === 'failed';

  if (status === 'blocked') return null;

  return running ? (
    <Button
      size="sm"
      icon="stop"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await haltGate({ relayId, role, gate });
          router.refresh();
        })
      }
    >
      {t('run.stopGate')}
    </Button>
  ) : (
    <Row wrap gap={8}>
      <Button
        size="sm"
        variant={finished ? 'default' : 'primary'}
        icon="relay"
        disabled={pending || status === 'waiting'}
        onClick={() =>
          start(async () => {
            const result = await runGate({ relayId, role, gate });
            setRefused(result.started ? null : runReasonKey(result.reason));
            router.refresh();
          })
        }
      >
        {finished ? t('run.rerunGate') : t('run.startGate')}
      </Button>
      {refused ? <span className="xs ink-warned">{t(refused as 'run.failed.unknown')}</span> : null}
    </Row>
  );
}

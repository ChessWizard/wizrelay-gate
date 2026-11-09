'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslator } from '@/shared/i18n/provider';
import { Banner, Button } from '@/shared/ui/primitives';
import { runTrack } from '@/features/gate-prompts/actions';

/**
 * Run the whole track.
 *
 * It walks the gates in order and stops at the first one that fails or asks something,
 * which is the honest behaviour for a pipeline: the gates after it were going to assume it
 * finished. The result says which gates ran and where it stopped, so the person is not
 * left guessing whether anything happened.
 */
export function TrackActions({
  relayId,
  role,
  track,
  disabled,
  disabledReason,
}: {
  relayId: string;
  role?: string;
  track: 'research' | 'delivery';
  disabled?: boolean;
  disabledReason?: string;
}) {
  const t = useTranslator();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState<{ ran: string[]; stoppedAt?: string } | null>(null);

  return (
    <div className="stack" style={{ gap: '8px' }}>
      <Button
        size="sm"
        variant="primary"
        icon="play"
        disabled={pending || disabled}
        title={disabled ? disabledReason : undefined}
        onClick={() =>
          start(async () => {
            const result = await runTrack({ relayId, role, track });
            setOutcome({ ran: result.ran, stoppedAt: result.stoppedAt });
            router.refresh();
          })
        }
      >
        {pending ? t('track.running') : t(`track.run.${track}` as 'track.run.delivery')}
      </Button>

      {outcome ? (
        <Banner
          tone={outcome.stoppedAt ? 'warn' : 'success'}
          inline
          title={
            outcome.ran.length === 0
              ? t('track.nothingToRun')
              : outcome.stoppedAt
                ? t('track.stoppedAt', {
                    gate: t(`gate.${outcome.stoppedAt}` as 'gate.pull'),
                    count: outcome.ran.length,
                  })
                : t('track.finished', { count: outcome.ran.length })
          }
        />
      ) : null}
    </div>
  );
}

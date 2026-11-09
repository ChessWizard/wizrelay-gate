'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslator } from '@/shared/i18n/provider';
import { Button, Row } from '@/shared/ui/primitives';
import { Icon } from '@/shared/ui/icons';
import { stopAsking } from '../actions';

/**
 * The offer to stop being asked, made where the asking happens.
 *
 * A setting buried in a preferences screen is found by the people who do not need it. The
 * person who needs it is the one answering the same question for the fifth time today, so
 * it is offered there — once they have answered this one, and never instead of answering
 * it. Turning it off applies to them alone.
 */
export function StopAsking({
  relayId,
  kindOf,
}: {
  relayId: string;
  kindOf: 'commit' | 'push';
}) {
  const t = useTranslator();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  if (done) {
    return (
      <Row gap={6}>
        <Icon name="passed" className="ink-passed" />
        <span className="xs t3">{done}</span>
      </Row>
    );
  }

  if (!open) {
    return (
      <button type="button" className="link-quiet xs" onClick={() => setOpen(true)}>
        {t('approval.stopAsking')}
      </button>
    );
  }

  const choose = (scope: 'relay' | 'all') =>
    start(async () => {
      await stopAsking({ relayId, scope, kindOf });
      setDone(t(scope === 'all' ? 'approval.stoppedAll' : 'approval.stoppedRelay'));
      router.refresh();
    });

  return (
    <Row wrap gap={8}>
      <span className="xs t3">{t('approval.stopScope')}</span>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => choose('relay')}>
        {t('approval.scopeRelay')}
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => choose('all')}>
        {t('approval.scopeAll')}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        {t('common.cancel')}
      </Button>
    </Row>
  );
}

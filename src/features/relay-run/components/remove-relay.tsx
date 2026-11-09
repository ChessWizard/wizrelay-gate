'use client';

import { useState, useTransition } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { Button, Row } from '@/shared/ui/primitives';
import { removeLocalRelay } from '../actions';

/**
 * Two steps, never one: the first click explains what removal does, the second does it.
 */
export function RemoveRelay({ relayId }: { relayId: string }) {
  const t = useTranslator();
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();

  if (!armed) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setArmed(true)}>
        {t('relay.removeLocal')}
      </Button>
    );
  }

  return (
    <Row wrap gap={8}>
      <span className="xs t3" style={{ maxWidth: '360px' }}>
        {t('relay.removeLocalNote')}
      </span>
      <Button
        size="sm"
        variant="danger"
        disabled={pending}
        onClick={() => start(() => void removeLocalRelay(relayId))}
      >
        {t('relay.removeLocalConfirm')}
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setArmed(false)}>
        {t('common.cancel')}
      </Button>
    </Row>
  );
}

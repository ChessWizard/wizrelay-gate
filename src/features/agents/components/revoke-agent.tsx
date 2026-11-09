'use client';

import { useState, useTransition } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { Button, Row } from '@/shared/ui/primitives';
import { removeAgent } from '../actions';

/**
 * Revoking is irreversible and silent on the other side — the machine simply stops being
 * answered — so it asks once rather than acting on the first click.
 */
export function RevokeAgent({ agentId, name }: { agentId: string; name: string }) {
  const t = useTranslator();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button size="sm" variant="ghost" icon="trash" onClick={() => setConfirming(true)}>
        {t('agent.revoke')}
      </Button>
    );
  }

  return (
    <Row wrap gap={6}>
      <span className="xs t3">{t('agent.revokeSure', { name })}</span>
      <Button
        size="sm"
        variant="danger"
        disabled={pending}
        onClick={() => start(() => void removeAgent(agentId))}
      >
        {t('agent.revokeYes')}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
        {t('common.cancel')}
      </Button>
    </Row>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { Button } from '@/shared/ui/primitives';
import { CopyButton } from '@/shared/ui/controls';
import { resetInvite } from '../actions';

/**
 * A new one-time link for someone whose invitation never arrived.
 *
 * Issuing one takes away the password they may already have set, so the old link and any
 * open session stop working the moment the new one is made.
 */
export function InviteLink({
  userId,
  origin,
  locked,
}: {
  userId: string;
  origin: string;
  locked: boolean;
}) {
  const t = useTranslator();
  const [token, setToken] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="stack" style={{ gap: '8px' }}>
      <div>
        <Button
          type="button"
          size="sm"
          icon="refresh"
          disabled={locked || pending}
          onClick={() =>
            start(async () => {
              const result = await resetInvite(userId);
              if (result.ok && result.value) setToken(result.value);
            })
          }
        >
          {t('people.resetInvite')}
        </Button>
      </div>

      {token ? (
        <div className="inset stack" style={{ gap: '6px' }}>
          <span className="label">{t('people.inviteLink')}</span>
          <div className="row wrap" style={{ gap: '8px' }}>
            <code className="mono sm trunc grow">{`${origin}/invite/${token}`}</code>
            <CopyButton
              value={`${origin}/invite/${token}`}
              label={t('common.copy')}
              copiedLabel={t('common.copied')}
            />
          </div>
          <span className="help">{t('people.inviteLinkHelp')}</span>
        </div>
      ) : null}
    </div>
  );
}

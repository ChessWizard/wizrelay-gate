'use client';

import { useEffect, useState, useTransition } from 'react';
import { formatPairingCode } from '@/core/agent/protocol';
import { useTranslator } from '@/shared/i18n/provider';
import { Banner, Button, CommandBlock, Row, Stack } from '@/shared/ui/primitives';
import { Icon } from '@/shared/ui/icons';
import { dropPairingCode, newPairingCode } from '../actions';

/**
 * Where the agent puts itself when it pairs. Pairing copies the downloaded file next to
 * its own config, so every command after the first one has a stable path instead of
 * whatever folder the download landed in.
 */
const AGENT_PATH = '~/.wizrelay-gate/wizrelay-agent.mjs';

/**
 * Pairing, from the person's side: press once, read eight characters, type them into a
 * terminal.
 *
 * The code is shown rather than mailed or copied into a link because the thing that needs
 * it is a shell on another window of the same screen. It is live for ten minutes and the
 * countdown is on the card, so nobody is left typing a code that stopped working while
 * they looked for the terminal.
 */
export function PairCard({ panelUrl }: { panelUrl: string }) {
  const t = useTranslator();
  const [pending, start] = useTransition();
  const [offer, setOffer] = useState<{ code: string; expiresAt: string } | null>(null);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!offer) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [offer]);

  const left = offer ? Math.max(0, Math.round((Date.parse(offer.expiresAt) - now) / 1_000)) : 0;

  if (!offer || left === 0) {
    return (
      <Row wrap gap={10}>
        <Button
          size="sm"
          variant="primary"
          icon="plus"
          disabled={pending}
          onClick={() => start(async () => setOffer(await newPairingCode()))}
        >
          {t('agent.pairStart')}
        </Button>
        <span className="xs t3">{t('agent.pairHint')}</span>
      </Row>
    );
  }

  const minutes = Math.floor(left / 60);
  const seconds = String(left % 60).padStart(2, '0');

  return (
    <Stack gap={10}>
      <Banner tone="info" inline title={t('agent.pairOpen', { time: `${minutes}:${seconds}` })} />
      <div className="paircode">
        <span className="mono">{formatPairingCode(offer.code)}</span>
      </div>
      <Stack gap={6}>
        <span className="xs t3">{t('agent.pairStep0')}</span>
        <CommandBlock command={`curl -fsSL ${panelUrl}/agent -o /tmp/wizrelay-agent.mjs`} />
        <span className="xs t3">{t('agent.pairStep1')}</span>
        <CommandBlock
          command={`node /tmp/wizrelay-agent.mjs pair ${formatPairingCode(offer.code)} --panel ${panelUrl}`}
        />
        <span className="xs t3">{t('agent.pairStep2')}</span>
        <CommandBlock command={`node ${AGENT_PATH} add ~/Repos/your-service`} />
        <span className="xs t3">{t('agent.pairStep3')}</span>
        <CommandBlock command={`node ${AGENT_PATH} run`} />
      </Stack>
      <Row wrap gap={8}>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await dropPairingCode();
              setOffer(null);
            })
          }
        >
          <Icon name="close" />
          {t('agent.pairCancel')}
        </Button>
      </Row>
    </Stack>
  );
}

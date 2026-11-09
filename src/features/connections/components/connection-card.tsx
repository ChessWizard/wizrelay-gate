'use client';

import { useActionState, useTransition } from 'react';
import type { ConnectionKind } from '@prisma/client';
import { useTranslator } from '@/shared/i18n/provider';
import { Banner, Button, Panel, Row, Stack } from '@/shared/ui/primitives';
import { Icon } from '@/shared/ui/icons';
import { removeConnection, saveConnection } from '@/features/admin/actions';
import type { ActionResult } from '@/features/admin/actions';

export function ConnectionCard({
  kind,
  title,
  help,
  docs,
  connected,
  masked,
  needsToken,
  needs,
}: {
  kind: ConnectionKind;
  title: string;
  help: string;
  docs: string;
  connected: boolean;
  masked: string | null;
  needsToken: boolean;
  /** What the token has to be allowed to do, in the words the provider uses. */
  needs?: { label: string; value: string }[];
}) {
  const t = useTranslator();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveConnection, null);
  const [removing, startRemove] = useTransition();

  return (
    <Panel
      title={title}
      aside={
        <span className={connected ? 'chip s-passed' : 'chip s-idle'}>
          <Icon name={connected ? 'passed' : 'idle'} />
          {connected ? t('connections.connected') : t('connections.notConnected')}
        </span>
      }
    >
      <Stack gap={10}>
        <span className="sm t2">{help}</span>

        {needs && needs.length > 0 ? (
          <div className="needs-list">
            <span className="label">{t('connections.needs')}</span>
            <ul>
              {needs.map((entry) => (
                <li key={entry.label}>
                  <span className="n">{entry.label}</span>
                  <span className="v mono">{entry.value}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {state?.ok ? <Banner tone="success" inline title={t('connections.saved')} /> : null}

        {needsToken ? (
          <form action={action} className="stack" style={{ gap: '8px' }}>
            <input type="hidden" name="kind" value={kind} />
            <div className="field">
              <label htmlFor={`token-${kind}`}>{t('connections.token')}</label>
              <input
                id={`token-${kind}`}
                name="token"
                type="password"
                className="input mono"
                placeholder={masked ?? ''}
                autoComplete="off"
              />
            </div>
            <Row wrap gap={8}>
              <Button type="submit" size="sm" variant="primary" disabled={pending}>
                {t('connections.connect')}
              </Button>
              {connected ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={removing}
                  onClick={() => startRemove(() => void removeConnection(kind))}
                >
                  {t('connections.disconnect')}
                </Button>
              ) : null}
              <a className="sm" href={docs} target="_blank" rel="noreferrer">
                {t('todo.open')} ↗
              </a>
            </Row>
          </form>
        ) : (
          <a className="sm" href={docs} target="_blank" rel="noreferrer">
            {t('todo.open')} ↗
          </a>
        )}
      </Stack>
    </Panel>
  );
}

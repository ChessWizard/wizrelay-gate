'use client';

import { useActionState } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { Banner, Button } from '@/shared/ui/primitives';
import { addHub } from '../actions';
import type { ActionResult } from '../actions';

export function HubForm() {
  const t = useTranslator();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addHub, null);

  return (
    <form action={action} className="stack" style={{ gap: 'var(--space-3)' }}>
      {state?.errorKey ? (
        <Banner
          tone="error"
          inline
          title={t(state.errorKey as 'error.forbidden')}
          body={state.value}
        />
      ) : null}
      <div className="field">
        <label htmlFor="hub-url">{t('hub.url')}</label>
        <input
          id="hub-url"
          name="url"
          className="input mono"
          placeholder="git@github.com:team/research-hub.git"
          required
        />
        <span className="help">{t('init.hubBody')}</span>
      </div>
      <div>
        <Button type="submit" variant="primary" icon="hub" disabled={pending}>
          {pending ? t('console.stream.connecting') : t('hub.add')}
        </Button>
      </div>
    </form>
  );
}

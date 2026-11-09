'use client';

import { useActionState } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { Banner, Button } from '@/shared/ui/primitives';
import { PasswordField } from '@/shared/ui/password-field';
import { signIn } from '../actions';
import type { AuthResult } from '../actions';

export function SignInForm() {
  const t = useTranslator();
  const [state, action, pending] = useActionState<AuthResult | null, FormData>(signIn, null);

  return (
    <form action={action} className="stack" style={{ gap: 'var(--space-4)' }}>
      {state?.errorKey ? (
        <Banner tone="error" inline title={t(state.errorKey as 'auth.error.invalid')} />
      ) : null}

      <div className="field">
        <label htmlFor="email">{t('auth.email')}</label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          autoComplete="username"
          required
          autoFocus
        />
        <span className="help">{t('auth.emailHelp')}</span>
      </div>

      <PasswordField
        name="password"
        label={t('auth.password')}
        autoComplete="current-password"
      />

      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? t('auth.signingIn') : t('auth.signIn')}
      </Button>
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { Banner, Button } from '@/shared/ui/primitives';
import { PasswordField } from '@/shared/ui/password-field';
import { acceptInvite } from '../actions';
import type { AuthResult } from '../actions';

export function InviteForm({ token, email }: { token: string; email: string }) {
  const t = useTranslator();
  const [state, action, pending] = useActionState<AuthResult | null, FormData>(acceptInvite, null);

  return (
    <form action={action} className="stack" style={{ gap: 'var(--space-4)' }}>
      <input type="hidden" name="token" value={token} />
      {state?.errorKey ? (
        <Banner tone="error" inline title={t(state.errorKey as 'auth.error.invalid')} />
      ) : null}

      <div className="field">
        <label htmlFor="email">{t('auth.email')}</label>
        <input id="email" className="input" value={email} readOnly disabled />
      </div>

      <PasswordField
        name="password"
        label={t('auth.newPassword')}
        autoComplete="new-password"
        rules
        autoFocus
      />

      <PasswordField
        name="confirm"
        label={t('auth.confirmPassword')}
        autoComplete="new-password"
      />

      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? t('auth.signingIn') : t('auth.setPassword')}
      </Button>
    </form>
  );
}

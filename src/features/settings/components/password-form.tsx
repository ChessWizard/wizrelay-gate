'use client';

import { useActionState } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { Banner, Button } from '@/shared/ui/primitives';
import { PasswordField } from '@/shared/ui/password-field';
import { changePassword } from '@/features/auth/actions';
import type { AuthResult } from '@/features/auth/actions';

export function PasswordForm({ bootstrap }: { bootstrap: boolean }) {
  const t = useTranslator();
  const [state, action, pending] = useActionState<AuthResult | null, FormData>(
    changePassword,
    null,
  );

  return (
    <form action={action} className="stack" style={{ gap: 'var(--space-3)' }}>
      {bootstrap && !state?.ok ? (
        <Banner tone="warn" inline title={t('settings.passwordBootstrap')} />
      ) : null}
      {state?.ok ? <Banner tone="success" inline title={t('settings.passwordChanged')} /> : null}
      {state?.errorKey ? (
        <Banner tone="error" inline title={t(state.errorKey as 'auth.error.missing')} />
      ) : null}

      <div className="pw-row">
        <PasswordField
          name="current"
          label={t('settings.passwordCurrent')}
          autoComplete="current-password"
        />
        <PasswordField
          name="password"
          label={t('settings.passwordNew')}
          autoComplete="new-password"
          rules
        />
        <PasswordField
          name="confirm"
          label={t('settings.passwordConfirm')}
          autoComplete="new-password"
        />
      </div>

      <Button type="submit" variant="primary" icon="lock" disabled={pending}>
        {t('settings.passwordChange')}
      </Button>

      <span className="help">{t('settings.passwordHelp')}</span>
    </form>
  );
}

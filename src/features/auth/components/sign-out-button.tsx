'use client';

import { useTransition } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { Button } from '@/shared/ui/primitives';
import { signOut } from '../actions';

export function SignOutButton({ size = 'default' }: { size?: 'sm' | 'default' }) {
  const t = useTranslator();
  const [pending, start] = useTransition();

  return (
    <Button
      size={size}
      variant="ghost"
      icon="external"
      disabled={pending}
      onClick={() => start(() => void signOut())}
    >
      {t('auth.signOut')}
    </Button>
  );
}

'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslator } from '@/shared/i18n/provider';
import { Button } from '@/shared/ui/primitives';
import { finishSetup } from '@/features/admin/actions';

export function FinishButton({ disabled }: { disabled: boolean }) {
  const t = useTranslator();
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="primary"
      size="lg"
      icon="passed"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          await finishSetup();
          router.push('/');
        })
      }
    >
      {t('setup.finish')}
    </Button>
  );
}

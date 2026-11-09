'use client';

import { useEffect } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { Banner, Button, Stack } from '@/shared/ui/primitives';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslator();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page">
      <Stack gap={12}>
        <Banner tone="error" title={t('error.commandFailed')} body={error.message} />
        <div>
          <Button variant="primary" onClick={reset}>
            {t('banner.retry')}
          </Button>
        </div>
      </Stack>
    </div>
  );
}

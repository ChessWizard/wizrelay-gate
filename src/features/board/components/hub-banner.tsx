'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslator } from '@/shared/i18n/provider';
import { Banner, Button } from '@/shared/ui/primitives';
import { refreshHub } from '../actions';

/**
 * Why the hub's packages are not on the board, and the one action that can change it.
 * An empty board with no explanation is the worst thing this screen can do.
 */
export function HubBanner({
  tone,
  title,
  body,
}: {
  tone: 'warn' | 'info';
  title: string;
  body?: string;
}) {
  const t = useTranslator();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Banner
      tone={tone}
      title={title}
      body={error ?? body}
      action={
        <Button
          size="sm"
          variant="primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await refreshHub();
              setError(result.ok ? null : (result.error ?? null));
              router.refresh();
            })
          }
        >
          {t('banner.hubFetch')}
        </Button>
      }
    />
  );
}

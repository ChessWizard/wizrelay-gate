'use client';

import { useTransition } from 'react';
import { useTranslator } from '@/shared/i18n/provider';
import { Button } from '@/shared/ui/primitives';
import { readAll, readItem } from '../actions';

export function ReadButton({ id }: { id: string }) {
  const t = useTranslator();
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => void readItem(id))}>
      {t('inbox.markRead')}
    </Button>
  );
}

export function ReadAllButton() {
  const t = useTranslator();
  const [pending, start] = useTransition();
  return (
    <Button size="sm" disabled={pending} onClick={() => start(() => void readAll())}>
      {t('inbox.markRead')}
    </Button>
  );
}

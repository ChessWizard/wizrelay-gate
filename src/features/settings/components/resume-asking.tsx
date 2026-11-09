'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslator } from '@/shared/i18n/provider';
import { Button } from '@/shared/ui/primitives';
import { resumeAsking } from '@/features/gate-prompts/actions';

/** Put a question back. One click, no confirmation: asking more is never the risky way. */
export function ResumeAsking({ relayId }: { relayId: string }) {
  const t = useTranslator();
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      size="sm"
      variant="ghost"
      icon="refresh"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await resumeAsking(relayId);
          router.refresh();
        })
      }
    >
      {t('approval.resume')}
    </Button>
  );
}

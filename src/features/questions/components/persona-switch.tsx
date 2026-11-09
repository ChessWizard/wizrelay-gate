'use client';

import { useRouter } from 'next/navigation';
import { useTranslator } from '@/shared/i18n/provider';
import { Segmented } from '@/shared/ui/controls';

/** Developer side or researcher inbox: the same questions, two jobs. */
export function PersonaSwitch({ active }: { active: 'mine' | 'inbox' }) {
  const router = useRouter();
  const t = useTranslator();

  return (
    <Segmented
      label={t('questions.title')}
      active={active}
      onSelect={(side) => router.push(side === 'inbox' ? '/questions?side=inbox' : '/questions')}
      options={[
        { id: 'mine', label: t('questions.developerSide') },
        { id: 'inbox', label: t('questions.researcherSide') },
      ]}
    />
  );
}

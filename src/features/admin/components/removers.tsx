'use client';

import { useRouter } from 'next/navigation';
import { useTranslator } from '@/shared/i18n/provider';
import { ConfirmButton } from '@/shared/ui/confirm';
import { removeHub, removePerson, removeProject } from '../actions';

export function RemoveHubButton({ hubId, projects }: { hubId: string; projects: number }) {
  const t = useTranslator();
  return (
    <ConfirmButton
      onConfirm={() => removeHub(hubId)}
      label={t('common.remove')}
      confirmLabel={t('hub.remove')}
      note={projects > 0 ? `${t('hub.removeNote')} (${projects})` : t('hub.removeNote')}
    />
  );
}

export function RemoveProjectButton({ projectId }: { projectId: string }) {
  const t = useTranslator();
  return (
    <ConfirmButton
      onConfirm={() => removeProject(projectId)}
      label={t('common.remove')}
      confirmLabel={t('project.remove')}
      note={t('project.removeNote')}
    />
  );
}

export function RemovePersonButton({ userId, locked }: { userId: string; locked: boolean }) {
  const t = useTranslator();
  const router = useRouter();
  return (
    <ConfirmButton
      disabled={locked}
      onConfirm={async () => {
        await removePerson(userId);
        router.push('/admin');
      }}
      label={t('people.remove')}
      confirmLabel={t('common.remove')}
      note={t('people.removeNote')}
    />
  );
}

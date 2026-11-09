import Link from 'next/link';
import { AppShell } from '@/features/shell/components/app-shell';
import { ActivityScreen } from '@/features/activity/components/activity-screen';
import { getWorkspace } from '@/services/store/store';
import { createTranslator } from '@/shared/i18n/translate';

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ who?: string; before?: string }>;
}) {
  const { who, before } = await searchParams;
  const workspace = await getWorkspace();
  const t = createTranslator(workspace.locale);

  return (
    <AppShell
      crumbs={
        <>
          <Link href="/">{t('board.title')}</Link>
          <span>/</span>
          <span>{t('activity.title')}</span>
        </>
      }
    >
      <ActivityScreen who={who} before={before} />
    </AppShell>
  );
}

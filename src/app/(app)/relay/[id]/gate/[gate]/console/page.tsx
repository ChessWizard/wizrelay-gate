import Link from 'next/link';
import { AppShell } from '@/features/shell/components/app-shell';
import { ConsoleScreen } from '@/features/console/components/console-screen';
import { getWorkspace } from '@/services/store/store';
import { createTranslator } from '@/shared/i18n/translate';

export default async function ConsolePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; gate: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const { id, gate } = await params;
  const { role } = await searchParams;
  const relayId = decodeURIComponent(id);
  const workspace = await getWorkspace();
  const t = createTranslator(workspace.locale);

  return (
    <AppShell
      crumbs={
        <>
          <Link href="/">{t('board.title')}</Link>
          <span>/</span>
          <Link className="mono" href={`/relay/${relayId}`}>
            {relayId}
          </Link>
          <span>/</span>
          <span className="mono">GATE.{gate.toUpperCase()}</span>
          <span>/</span>
          <span>{t('run.tab.console')}</span>
        </>
      }
    >
      <ConsoleScreen relayId={relayId} gate={gate} role={role} />
    </AppShell>
  );
}

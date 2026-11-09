import { redirect } from 'next/navigation';
import { AppShell } from '@/features/shell/components/app-shell';
import { BoardScreen } from '@/features/board/components/board-screen';
import { requireUser } from '@/services/auth/context';
import { activeContext } from '@/services/panel/active';
import { panelState } from '@/services/auth/bootstrap';

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { viewer } = await requireUser();
  const [context, state] = await Promise.all([activeContext(), panelState()]);

  if (!state.initialized && viewer.globalRole === 'OWNER') redirect('/setup');
  if (context.hubs.length === 0 && viewer.globalRole !== 'MEMBER') redirect('/setup');

  const { q } = await searchParams;

  return (
    <AppShell>
      <BoardScreen q={q ?? ''} />
    </AppShell>
  );
}

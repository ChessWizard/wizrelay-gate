import { AppShell } from '@/features/shell/components/app-shell';
import { RunScreen } from '@/features/relay-run/components/run-screen';

export default async function RelayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ role?: string; gate?: string }>;
}) {
  const { id } = await params;
  const { role, gate } = await searchParams;

  return (
    <AppShell>
      <RunScreen relayId={decodeURIComponent(id)} role={role} gate={gate} />
    </AppShell>
  );
}

import { AppShell } from '@/features/shell/components/app-shell';
import { RoutingScreen } from '@/features/routing/components/routing-screen';

export default async function RoutingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const { id } = await params;
  const { role } = await searchParams;

  return (
    <AppShell>
      <RoutingScreen relayId={decodeURIComponent(id)} role={role} />
    </AppShell>
  );
}

import { AppShell } from '@/features/shell/components/app-shell';
import { VerifyScreen } from '@/features/verify/components/verify-screen';

export default async function VerifyPage({
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
      <VerifyScreen relayId={decodeURIComponent(id)} role={role} />
    </AppShell>
  );
}

import { AppShell } from '@/features/shell/components/app-shell';
import { AuditScreen } from '@/features/audit/components/audit-screen';

export default async function AuditPage({
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
      <AuditScreen relayId={decodeURIComponent(id)} role={role} />
    </AppShell>
  );
}

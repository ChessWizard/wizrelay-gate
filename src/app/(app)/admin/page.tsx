import { AppShell } from '@/features/shell/components/app-shell';
import { AdminScreen } from '@/features/admin/components/admin-screen';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return (
    <AppShell>
      <AdminScreen tab={tab} />
    </AppShell>
  );
}

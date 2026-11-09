import { AppShell } from '@/features/shell/components/app-shell';
import { PersonScreen } from '@/features/admin/components/person-screen';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell>
      <PersonScreen id={id} />
    </AppShell>
  );
}

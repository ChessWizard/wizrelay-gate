import { AppShell } from '@/features/shell/components/app-shell';
import { PackagesScreen } from '@/features/packages/components/packages-screen';

export default async function RelaysPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return (
    <AppShell>
      <PackagesScreen query={q ?? ''} />
    </AppShell>
  );
}

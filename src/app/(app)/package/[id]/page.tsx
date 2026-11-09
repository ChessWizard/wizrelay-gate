import { AppShell } from '@/features/shell/components/app-shell';
import { PackageScreen } from '@/features/package-workspace/components/package-screen';

export default async function PackagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ file?: string; role?: string }>;
}) {
  const { id } = await params;
  const { file, role } = await searchParams;

  return (
    <AppShell>
      <PackageScreen relayId={decodeURIComponent(id)} file={file} role={role} />
    </AppShell>
  );
}

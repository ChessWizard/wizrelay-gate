import { AppShell } from '@/features/shell/components/app-shell';
import { ValidateScreen } from '@/features/validate/components/validate-screen';

export default async function ValidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <ValidateScreen relayId={decodeURIComponent(id)} />
    </AppShell>
  );
}
